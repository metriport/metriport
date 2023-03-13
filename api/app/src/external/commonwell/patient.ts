import {
  CommonWell,
  getIdTrailingSlash,
  Patient as CommonwellPatient,
  RequestMetadata,
} from "@metriport/commonwell-sdk";
import { ExternalMedicalPartners } from "..";
import { Patient, PatientExternalData } from "../../models/medical/patient";
import { PatientLinkStatusDTO } from "../../routes/medical/dtos/linkDTO";
import { debug } from "../../shared/log";
import { oid } from "../../shared/oid";
import { Util } from "../../shared/util";
import { makeCommonWellAPI, organizationQueryMeta } from "./api";
import { makePersonForPatient, patientToCommonwell } from "./patient-conversion";
import { setCommonwellId } from "./patient-external-data";
import { findOrCreatePerson, getPatientData, PatientDataCommonwell } from "./patient-shared";
import { Config } from "../../shared/config";
import { registerPatient as sbRegisterPatient } from "./sandbox-payloads";

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
  const { commonWell, queryMeta, commonwellPatient, commonwellPatientId, commonwellPersonId } =
    updateData;

  const { patientRefLink } = await updatePatient({
    commonWell,
    queryMeta,
    commonwellPatient,
    commonwellPatientId,
  });

  if (!commonwellPersonId) {
    // TODO #369 two possible situations here:
    // (1) we found more than one match upon create, customer updates demographics and now we find only one and match - happy path
    // (2) customer/end user asked to be removed from CW (how? to whom?): an update on Metri means recreate @ CW or not?
    const newCommonwellPersonId = await findOrCreatePersonAndLink({
      commonWell,
      queryMeta,
      commonwellPatient,
      commonwellPatientId,
      patientRefLink,
    });
    if (!newCommonwellPersonId) {
      log(`WARN - Called findOrCreatePerson after update but still no CW person ID`);
      return;
    }
    await setCommonwellId({
      patientId: patient.id,
      cxId: patient.cxId,
      commonwellPatientId,
      commonwellPersonId: newCommonwellPersonId,
    });
    return;
  }

  const person = makePersonForPatient(commonwellPatient);
  try {
    // DUMMY MOCK THIS
    const respPerson = await commonWell.updatePerson(queryMeta, person, commonwellPersonId);
    debug(`resp updatePerson: `, respPerson);
    //eslint-disable-next-line @typescript-eslint/no-explicit-any
  } catch (err: any) {
    // TODO #369 if the error is a 404, we should try to insert a person

    log(
      `ERR - Failed to update patient - Patient updated @ CW but not the Person - ` +
        `Patient @ CW: ${commonwellPatientId}, ` +
        `Person @ CW: ${commonwellPersonId}`
    );
    throw err;
  }

  // REVIEW PERSON-PATIENT LINK
  try {
    // Make sure the link between person and patient exists and its LOLA2
    // TODO #369
    //eslint-disable-next-line @typescript-eslint/no-explicit-any
  } catch (err: any) {
    log(
      `ERR - Failed to validate patient/person link - ` +
        `Patient @ CW: ${commonwellPatientId}, ` +
        `Person @ CW: ${commonwellPersonId}`
    );
    throw err;
  }

  // REVIEW NETWORK LINKS? - this might be a good opportunity to update link to new Patients
  // added to CW we didn't know about when we first added this Patient
  // TODO #415
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
      commonwellPersonId: string | undefined;
    }
  | undefined
> {
  const commonwellData = patient.data.externalData
    ? (patient.data.externalData[ExternalMedicalPartners.COMMONWELL] as PatientDataCommonwell) // TODO validate the type
    : undefined;
  if (!commonwellData) return undefined;
  const commonwellPatientId = commonwellData.patientId;
  const commonwellPersonId = commonwellData.personId;

  const { organization, facility } = await getPatientData(patient, facilityId);
  const orgName = organization.data.name;
  const orgId = organization.id;
  const facilityNPI = facility.data["npi"] as string; // TODO #414 move to strong type - remove `as string`

  const queryMeta = organizationQueryMeta(orgName, { npi: facilityNPI });
  const commonwellPatient = patientToCommonwell({ patient, orgName, orgId });
  const commonWell = makeCommonWellAPI(orgName, oid(orgId));

  return { commonWell, queryMeta, commonwellPatient, commonwellPatientId, commonwellPersonId };
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
  const { log } = Util.out(`CW findOrCreatePersonAndLink - CW patientId ${commonwellPatientId}`);
  let commonwellPersonId: string | undefined;
  try {
    commonwellPersonId = await findOrCreatePerson({
      commonWell,
      queryMeta,
      commonwellPatient,
      commonwellPatientId,
    });
  } catch (err) {
    log(`Error calling findOrCreatePerson`);
    throw err;
  }

  if (!commonwellPersonId) return undefined;

  try {
    // DUMMY MOCK THIS
    await commonWell.patientLink(queryMeta, commonwellPersonId, patientRefLink);
  } catch (err) {
    log(`ERR - Patient created @ CW but could not link w/ Person`);
    throw err;
  }

  // NETWORK LINKS
  // TODO #415

  return commonwellPersonId;
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
  // DUMMY MOCK THIS
  const respPatient = await sandBoxWrapper(
    async () => await commonWell.registerPatient(queryMeta, commonwellPatient),
    sbRegisterPatient
  );
  debug(`resp registerPatient: `, respPatient);
  const commonwellPatientId = getIdTrailingSlash(respPatient);
  const log = Util.log(`CW registerPatient - CW patientId ${commonwellPatientId}`);
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

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const sandBoxWrapper = async (cwCb: () => any, sandboxPayload: any) => {
  if (Config.isSandbox()) {
    return sandboxPayload;
  }

  return cwCb();
};

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

  // DUMMY MOCK THIS
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
