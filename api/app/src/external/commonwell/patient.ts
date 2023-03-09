import {
  CommonWell,
  getIdTrailingSlash,
  LOLA,
  Patient as CommonwellPatient,
  RequestMetadata,
} from "@metriport/commonwell-sdk";
import { ExternalMedicalPartners } from "..";
import { Patient, PatientExternalData } from "../../models/medical/patient";
import { PatientLinkStatusDTO } from "../../routes/medical/dtos/linkDTO";
import { sendAlert } from "../../shared/notifications";
import { oid } from "../../shared/oid";
import { Util } from "../../shared/util";
import { makeCommonWellAPI, organizationQueryMeta } from "./api";
import { makePersonForPatient, patientToCommonwell } from "./patient-conversion";
import { setCommonwellId } from "./patient-external-data";
import {
  findOrCreatePerson,
  getMatchingStrongIds,
  getPatientData,
  PatientDataCommonwell,
} from "./patient-shared";

export function mapPatientExternal(data: PatientExternalData | undefined): PatientLinkStatusDTO {
  return data
    ? (data[ExternalMedicalPartners.COMMONWELL] as PatientDataCommonwell).personId
      ? "linked"
      : "needs-review"
    : "needs-review";
}

export async function create(patient: Patient, facilityId: string): Promise<void> {
  const { organization, facility } = await getPatientData(patient, facilityId);

  const orgName = organization.data.name;
  const orgId = organization.id;
  const facilityNPI = facility.data["npi"] as string; // TODO #414 move to strong type - remove `as string`

  const { commonwellPatientId, commonwellPersonId } = await createPatientAtCommonwell({
    patient,
    orgName,
    orgId,
    facilityNPI,
  });

  await setCommonwellId({
    patientId: patient.id,
    cxId: patient.cxId,
    commonwellPatientId,
    commonwellPersonId,
  });
}

export async function update(patient: Patient, facilityId: string): Promise<void> {
  const { log, debug } = Util.out(`CW update - M patientId ${patient.id}`);

  const updateData = await setupUpdate(patient, facilityId);
  if (!updateData) {
    log(`WARN - Could not find external data on Patient, not updating @ CW`);
    return;
  }
  const { commonWell, queryMeta, commonwellPatient, commonwellPatientId, personId } = updateData;

  const { patientRefLink } = await updatePatient({
    commonWell,
    queryMeta,
    commonwellPatient,
    commonwellPatientId,
  });

  // No person yet, try to find/create with new patient demographics
  if (!personId) {
    await findOrCreatePersonLinkAndStoreOnDB({
      commonWell,
      queryMeta,
      patient,
      commonwellPatient,
      commonwellPatientId,
      patientRefLink,
    });
    return;
  }

  // Already has a matching person, so update that person's demographics as well
  const person = makePersonForPatient(commonwellPatient);
  try {
    try {
      const respPerson = await commonWell.updatePerson(queryMeta, person, personId);
      debug(`resp updatePerson: `, respPerson);

      if (!respPerson.enrolled) {
        const respReenroll = await commonWell.reenrollPerson(queryMeta, personId);
        debug(`resp reenrolPerson: `, respReenroll);
      }
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } catch (err: any) {
      if (err.response?.status !== 404) throw err;
      const subject = "Got 404 when trying to update person @ CW";
      const message = `CW Person ID ${personId}\nTrying to find/create it...`;
      sendAlert({ subject, message });
      log(`${subject} - ${message}`);
      await findOrCreatePersonLinkAndStoreOnDB({
        commonWell,
        queryMeta,
        patient,
        commonwellPatient,
        commonwellPatientId,
        patientRefLink,
      });
      return;
    }
    //eslint-disable-next-line @typescript-eslint/no-explicit-any
  } catch (err: any) {
    log(
      `ERR - Failed to update patient - Patient updated @ CW but not the Person - ` +
        `Patient @ CW: ${commonwellPatientId}, ` +
        `Person @ CW: ${personId}`
    );
    throw err;
  }

  // Try to get the Person<>Patient link to LOLA3
  try {
    const respLinks = await commonWell.getPatientLinks(queryMeta, personId);
    debug(`resp getPatientLinks: ${JSON.stringify(respLinks)}`);
    const linkToPatient = respLinks._embedded?.patientLink
      ? respLinks._embedded.patientLink.find(l =>
          l.patient ? l.patient.includes(commonwellPatientId) : false
        )
      : undefined;
    if (
      !linkToPatient ||
      !linkToPatient.assuranceLevel ||
      ![LOLA.level_3, LOLA.level_4].map(toString).includes(linkToPatient.assuranceLevel)
    ) {
      const strongIds = getMatchingStrongIds(person, commonwellPatient);
      const respLink = await commonWell.addPatientLink(
        queryMeta,
        personId,
        patientRefLink,
        // safe to get the first one, just need to match one of the person's strong IDs
        strongIds.length ? strongIds[0] : undefined
      );
      debug(`resp patientLink: `, respLink);
    }
  } catch (err) {
    log(
      `ERR - Failed to updgrade patient/person link - ` +
        `Patient @ CW: ${commonwellPatientId}, ` +
        `Person @ CW: ${personId}`
    );
    throw err;
  }

  // REVIEW NETWORK LINKS? - this might be a good opportunity to update link to new Patients
  // added to CW we didn't know about when we first added this Patient
  // TODO #415
}

async function findOrCreatePersonLinkAndStoreOnDB({
  commonWell,
  queryMeta,
  patient,
  commonwellPatient,
  commonwellPatientId,
  patientRefLink,
}: {
  commonWell: CommonWell;
  queryMeta: RequestMetadata;
  patient: Patient;
  commonwellPatient: CommonwellPatient;
  commonwellPatientId: string;
  patientRefLink: string;
}) {
  const { log } = Util.out(
    `CW findOrCreatePersonLinkAndStoreOnDB - CW patientId ${commonwellPatientId}`
  );
  const personId = await findOrCreatePersonAndLink({
    commonWell,
    queryMeta,
    commonwellPatient,
    commonwellPatientId,
    patientRefLink,
  });
  if (!personId) {
    log(`WARN - Called findOrCreatePerson after update but still no CW person ID`);
    return;
  }
  await setCommonwellId({
    patientId: patient.id,
    cxId: patient.cxId,
    commonwellPatientId,
    commonwellPersonId: personId,
  });
  return personId;
}

async function setupUpdate(
  patient: Patient,
  facilityId: string
): Promise<
  | {
      commonWell: CommonWell;
      queryMeta: RequestMetadata;
      commonwellPatient: CommonwellPatient;
      commonwellPatientId: string;
      personId: string | undefined;
    }
  | undefined
> {
  const commonwellData = patient.data.externalData
    ? (patient.data.externalData[ExternalMedicalPartners.COMMONWELL] as PatientDataCommonwell) // TODO validate the type
    : undefined;
  if (!commonwellData) return undefined;
  const commonwellPatientId = commonwellData.patientId;
  const personId = commonwellData.personId;

  const { organization, facility } = await getPatientData(patient, facilityId);
  const orgName = organization.data.name;
  const orgId = organization.id;
  const facilityNPI = facility.data["npi"] as string; // TODO #414 move to strong type - remove `as string`

  const queryMeta = organizationQueryMeta(orgName, { npi: facilityNPI });
  const commonwellPatient = patientToCommonwell({ patient, orgName, orgId });
  const commonWell = makeCommonWellAPI(orgName, oid(orgId));

  return { commonWell, queryMeta, commonwellPatient, commonwellPatientId, personId };
}

async function createPatientAtCommonwell({
  patient,
  orgName,
  orgId,
  facilityNPI,
}: {
  patient: Patient;
  orgName: string;
  orgId: string;
  facilityNPI: string;
}): Promise<{ commonwellPatientId: string; commonwellPersonId: string | undefined }> {
  const { log } = Util.out(`CW createPatientAt.. - M patientId ${patient.id}`);
  const commonWell = makeCommonWellAPI(orgName, oid(orgId));
  const queryMeta = organizationQueryMeta(orgName, { npi: facilityNPI });
  const commonwellPatient = patientToCommonwell({ patient, orgName, orgId });
  log(`${JSON.stringify(commonwellPatient, undefined, 2)}`);

  const { commonwellPatientId, patientRefLink } = await registerPatient({
    commonWell,
    queryMeta,
    commonwellPatient,
  });

  const commonwellPersonId = await findOrCreatePersonAndLink({
    commonWell,
    queryMeta,
    commonwellPatient,
    commonwellPatientId,
    patientRefLink,
  });

  return { commonwellPatientId, commonwellPersonId };
}

async function findOrCreatePersonAndLink({
  commonWell,
  queryMeta,
  commonwellPatient,
  commonwellPatientId,
  patientRefLink,
}: {
  commonWell: CommonWell;
  queryMeta: RequestMetadata;
  commonwellPatient: CommonwellPatient;
  commonwellPatientId: string;
  patientRefLink: string;
}): Promise<string | undefined> {
  const { log, debug } = Util.out(
    `CW findOrCreatePersonAndLink - CW patientId ${commonwellPatientId}`
  );
  let findOrCreateResponse;
  try {
    findOrCreateResponse = await findOrCreatePerson({
      commonWell,
      queryMeta,
      commonwellPatient,
      commonwellPatientId,
    });
  } catch (err) {
    log(`Error calling findOrCreatePerson @ CW`);
    throw err;
  }
  if (!findOrCreateResponse) return undefined;
  const { personId, person } = findOrCreateResponse;
  try {
    const strongIds = getMatchingStrongIds(person, commonwellPatient);
    const respLink = await commonWell.addPatientLink(
      queryMeta,
      personId,
      patientRefLink,
      // safe to get the first one, just need to match one of the person's strong IDs
      strongIds.length ? strongIds[0] : undefined
    );
    debug(`resp patientLink: `, respLink);
  } catch (err) {
    log(`Error linking Patient<>Person @ CW - personId: ${personId}`);
    throw err;
  }

  // NETWORK LINKS
  // TODO #415

  return personId;
}

async function registerPatient({
  commonWell,
  queryMeta,
  commonwellPatient,
}: {
  commonWell: CommonWell;
  queryMeta: RequestMetadata;
  commonwellPatient: CommonwellPatient;
}): Promise<{ commonwellPatientId: string; patientRefLink: string }> {
  const fnName = `CW registerPatient`;
  const debug = Util.debug(fnName);
  const respPatient = await commonWell.registerPatient(queryMeta, commonwellPatient);
  debug(`resp registerPatient: `, respPatient);
  const commonwellPatientId = getIdTrailingSlash(respPatient);
  const log = Util.log(`${fnName} - CW patientId ${commonwellPatientId}`);
  if (!commonwellPatientId) {
    const msg = `Could not determine the patient ID from CW`;
    log(
      `ERR - ${msg} - Patient created @ CW but not the Person - ` +
        `Patient @ Commonwell: ${JSON.stringify(respPatient)}`
    );
    throw new Error(msg);
  }
  const patientRefLink = respPatient._links?.self?.href;
  if (!patientRefLink) {
    const msg = `Could not determine the patient ref link`;
    log(
      `ERR - ${msg} - Patient created @ CW but not the Person - ` +
        `Patient @ Commonwell: ${JSON.stringify(respPatient)}`
    );
    throw new Error(msg);
  }
  return { commonwellPatientId, patientRefLink };
}

async function updatePatient({
  commonWell,
  queryMeta,
  commonwellPatient,
  commonwellPatientId,
}: {
  commonWell: CommonWell;
  queryMeta: RequestMetadata;
  commonwellPatient: CommonwellPatient;
  commonwellPatientId: string;
}): Promise<{ patientRefLink: string }> {
  const { log, debug } = Util.out(`CW updatePatient - CW patientId ${commonwellPatientId}`);

  const respUpdate = await commonWell.updatePatient(
    queryMeta,
    commonwellPatient,
    commonwellPatientId
  );
  debug(`resp updatePatient: `, respUpdate);

  const patientRefLink = respUpdate._links?.self?.href;
  if (!patientRefLink) {
    const msg = `Could not determine the patient ref link`;
    log(
      `ERR - ${msg} - Patient updated @ CW but failed to get refLink - ` +
        `respUpdate: ${JSON.stringify(respUpdate)}`
    );
    throw new Error(msg);
  }
  return { patientRefLink };
}
