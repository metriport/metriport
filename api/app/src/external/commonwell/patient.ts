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
import { Config } from "../../shared/config";
import { registerPatient as sbRegisterPatient } from "./sandbox-payloads";

export function mapPatientExternal(data: PatientExternalData | undefined): PatientLinkStatusDTO {
  return data
    ? (data[ExternalMedicalPartners.COMMONWELL] as PatientDataCommonwell).personId
      ? "linked"
      : "needs-review"
    : "needs-review";
}

type StoreIdsFunction = (params: {
  commonwellPatientId: string;
  personId?: string;
}) => Promise<void>;

function getStoreIdsFn(patientId: string, cxId: string): StoreIdsFunction {
  return async ({
    commonwellPatientId,
    personId,
  }: {
    commonwellPatientId: string;
    personId?: string;
  }): Promise<void> => {
    await setCommonwellId({
      patientId,
      cxId,
      commonwellPatientId,
      commonwellPersonId: personId,
    });
  };
}

export async function create(patient: Patient, facilityId: string): Promise<void> {
  const { debug } = Util.out(`CW create - M patientId ${patient.id}`);

  const { organization, facility } = await getPatientData(patient, facilityId);
  const orgName = organization.data.name;
  const orgId = organization.id;
  const facilityNPI = facility.data["npi"] as string; // TODO #414 move to strong type - remove `as string`

  const storeIds = getStoreIdsFn(patient.id, patient.cxId);

  const commonWell = makeCommonWellAPI(orgName, oid(orgId));
  const queryMeta = organizationQueryMeta(orgName, { npi: facilityNPI });
  const commonwellPatient = patientToCommonwell({ patient, orgName, orgId });
  debug(`Registering this Patient: ${JSON.stringify(commonwellPatient, undefined, 2)}`);

  const { commonwellPatientId, patientRefLink } = await registerPatient({
    commonWell,
    queryMeta,
    commonwellPatient,
    storeIds,
  });

  await findOrCreatePersonAndLink({
    commonWell,
    queryMeta,
    commonwellPatient,
    commonwellPatientId,
    patientRefLink,
    storeIds,
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
    await findOrCreatePersonAndLink({
      commonWell,
      queryMeta,
      commonwellPatient,
      commonwellPatientId,
      patientRefLink,
      storeIds: getStoreIdsFn(patient.id, patient.cxId),
    });
    return;
  }

  // Already has a matching person, so update that person's demographics as well
  const person = makePersonForPatient(commonwellPatient);
  try {
    try {
      // DUMMY MOCK THIS
      const respPerson = await commonWell.updatePerson(queryMeta, person, personId);
      debug(`resp updatePerson: ${JSON.stringify(respPerson, null, 2)}`);

      if (!respPerson.enrolled) {
        // DUMMY MOCK THIS
        const respReenroll = await commonWell.reenrollPerson(queryMeta, personId);
        debug(`resp reenrolPerson: ${JSON.stringify(respReenroll, null, 2)}`);
      }
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } catch (err: any) {
      if (err.response?.status !== 404) throw err;
      const subject = "Got 404 when trying to update person @ CW";
      const message = `CW Person ID ${personId}\nTrying to find/create it...`;
      sendAlert({ subject, message });
      log(`${subject} - ${message}`);
      await findOrCreatePersonAndLink({
        commonWell,
        queryMeta,
        commonwellPatient,
        commonwellPatientId,
        patientRefLink,
        storeIds: getStoreIdsFn(patient.id, patient.cxId),
      });
      return;
    }
    //eslint-disable-next-line @typescript-eslint/no-explicit-any
  } catch (err: any) {
    log(
      `ERR - Failed to update person - ` +
        `Patient @ CW: ${commonwellPatientId}, ` +
        `Person @ CW: ${personId}`
    );
    throw err;
  }

  // Try to get the Person<>Patient link to LOLA3
  try {
    // DUMMY MOCK THIS
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
      // DUMMY MOCK THIS
      const respLink = await commonWell.addPatientLink(
        queryMeta,
        personId,
        patientRefLink,
        // safe to get the first one, just need to match one of the person's strong IDs
        strongIds.length ? strongIds[0] : undefined
      );
      debug(`resp patientLink: ${JSON.stringify(respLink, null, 2)}`);
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

async function findOrCreatePersonAndLink({
  commonWell,
  queryMeta,
  commonwellPatient,
  commonwellPatientId,
  patientRefLink,
  storeIds,
}: {
  commonWell: CommonWell;
  queryMeta: RequestMetadata;
  commonwellPatient: CommonwellPatient;
  commonwellPatientId: string;
  patientRefLink: string;
  storeIds: StoreIdsFunction;
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

  await storeIds({ commonwellPatientId, personId });

  // Link Person to Patient
  try {
    const strongIds = getMatchingStrongIds(person, commonwellPatient);

    // DUMMY MOCK THIS
    const respLink = await commonWell.addPatientLink(
      queryMeta,
      personId,
      patientRefLink,
      // safe to get the first one, just need to match one of the person's strong IDs
      strongIds.length ? strongIds[0] : undefined
    );
    debug(`resp patientLink: ${JSON.stringify(respLink, null, 2)}`);
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
  storeIds,
}: {
  commonWell: CommonWell;
  queryMeta: RequestMetadata;
  commonwellPatient: CommonwellPatient;
  storeIds: StoreIdsFunction;
}): Promise<{ commonwellPatientId: string; patientRefLink: string }> {
  const fnName = `CW registerPatient`;
  const debug = Util.debug(fnName);

  // DUMMY MOCK THIS
  const respPatient = await sandBoxWrapper<CommonwellPatient>(
    async () => await commonWell.registerPatient(queryMeta, commonwellPatient),
    sbRegisterPatient
  );

  debug(`resp registerPatient: ${JSON.stringify(respPatient, null, 2)}`);
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

  await storeIds({ commonwellPatientId });

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

  // DUMMY MOCK THIS
  const respUpdate = await commonWell.updatePatient(
    queryMeta,
    commonwellPatient,
    commonwellPatientId
  );
  debug(`resp updatePatient: ${JSON.stringify(respUpdate, null, 2)}`);

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

const sandBoxWrapper = async <T>(cwCb: () => Promise<T>, sandboxPayload: T): Promise<T> => {
  if (Config.isSandbox()) {
    return sandboxPayload;
  }

  return await cwCb();
};
