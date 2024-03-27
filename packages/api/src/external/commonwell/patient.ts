import {
  CommonWellAPI,
  getIdTrailingSlash,
  LOLA,
  organizationQueryMeta,
  Patient as CommonwellPatient,
  Person,
  RequestMetadata,
  StrongId,
} from "@metriport/commonwell-sdk";
import { oid } from "@metriport/core/domain/oid";
import { Organization } from "@metriport/core/domain/organization";
import { Patient, PatientExternalData } from "@metriport/core/domain/patient";
import { MedicalDataSource } from "@metriport/core/external/index";
import { errorToString } from "@metriport/shared/common/error";
import { Facility } from "../../domain/medical/facility";
import MetriportError from "../../errors/metriport-error";
import { capture } from "../../shared/notifications";
import { Util } from "../../shared/util";
import { isEnhancedCoverageEnabledForCx, isCWEnabledForCx } from "../aws/appConfig";
import { LinkStatus } from "../patient-link";
import { makeCommonWellAPI } from "./api";
import { autoUpgradeNetworkLinks } from "./link/shared";
import { makePersonForPatient, patientToCommonwell } from "./patient-conversion";
import { queryAndProcessDocuments } from "./document/document-query";
import { setCommonwellId, resetPatientScheduledDocQueryRequestId } from "./patient-external-data";
import {
  CQLinkStatus,
  findOrCreatePerson,
  FindOrCreatePersonResponse,
  getMatchingStrongIds,
  getPatientData,
  PatientDataCommonwell,
} from "./patient-shared";

const createContext = "cw.patient.create";
const updateContext = "cw.patient.update";
const deleteContext = "cw.patient.delete";

export function getCWData(
  data: PatientExternalData | undefined
): PatientDataCommonwell | undefined {
  if (!data) return undefined;
  return data[MedicalDataSource.COMMONWELL] as PatientDataCommonwell; // TODO validate the type
}

/**
 * Returns the status of linking the Patient with CommonWell.
 */
export function getLinkStatusCW(data: PatientExternalData | undefined): LinkStatus {
  const defaultStatus: LinkStatus = "processing";
  if (!data) return defaultStatus;
  return getCWData(data)?.status ?? defaultStatus;
}

/**
 * Returns the status of linking the Patient with CommonWell's CareQuality bridge. Used for
 * Enhanced Coverage.
 */
export function getLinkStatusCQ(data: PatientExternalData | undefined): CQLinkStatus {
  const defaultStatus: CQLinkStatus = "unlinked";
  if (!data) return defaultStatus;
  return getCWData(data)?.cqLinkStatus ?? defaultStatus;
}

type StoreIdsFunction = (params: {
  commonwellPatientId: string;
  personId?: string;
  status?: LinkStatus;
}) => Promise<void>;

function getStoreIdsFn(
  patientId: string,
  cxId: string,
  cqLinkStatus?: CQLinkStatus
): StoreIdsFunction {
  return async ({
    commonwellPatientId,
    personId,
    status,
  }: {
    commonwellPatientId: string;
    personId?: string;
    status?: LinkStatus;
  }): Promise<void> => {
    await setCommonwellId({
      patientId,
      cxId,
      commonwellPatientId,
      commonwellPersonId: personId,
      commonwellStatus: status,
      cqLinkStatus,
    });
  };
}

export async function create(
  patient: Patient,
  facilityId: string,
  getOrgIdExcludeList: () => Promise<string[]>,
  patientData?: {
    organization: Organization;
    facility: Facility;
  }
): Promise<{ commonwellPatientId: string; personId: string } | undefined> {
  let commonWell: CommonWellAPI | undefined;
  try {
    const { debug } = Util.out(`CW create - M patientId ${patient.id}`);

    if (!(await isCWEnabledForCx(patient.cxId))) {
      debug(`CW disabled for cx ${patient.cxId}, skipping...`);
      return undefined;
    }

    const { organization, facility } = patientData ?? (await getPatientData(patient, facilityId));
    const orgName = organization.data.name;
    const orgOID = organization.oid;
    const facilityNPI = facility.data["npi"] as string; // TODO #414 move to strong type - remove `as string`

    // Patients of cxs that not go through EC should have theis status undefined so they're not picked up later
    // when we enable it
    const cqLinkStatus = (await isEnhancedCoverageEnabledForCx(patient.cxId))
      ? "unlinked"
      : undefined;
    const storeIds = getStoreIdsFn(patient.id, patient.cxId, cqLinkStatus);

    commonWell = makeCommonWellAPI(orgName, oid(orgOID));
    const queryMeta = organizationQueryMeta(orgName, { npi: facilityNPI });
    const commonwellPatient = patientToCommonwell({ patient, orgName, orgOID });
    debug(`Registering this Patient: `, () => JSON.stringify(commonwellPatient, null, 2));

    const { commonwellPatientId, patientRefLink } = await registerPatient({
      commonWell,
      queryMeta,
      commonwellPatient,
      storeIds,
    });

    const personId = await findOrCreatePersonAndLink({
      commonWell,
      queryMeta,
      commonwellPatient,
      commonwellPatientId,
      patientRefLink,
      storeIds,
      getOrgIdExcludeList,
    });

    return { commonwellPatientId, personId };
  } catch (error) {
    const msg = `Failure while creating patient @ CW`;
    console.error(`${msg}. Patient ID: ${patient.id}. Cause: ${error}`);
    capture.message(msg, {
      extra: {
        facilityId,
        patientId: patient.id,
        cwReference: commonWell?.lastReferenceHeader,
        context: createContext,
        error,
      },
      level: "error",
    });
    throw error;
  }
}

export async function update(
  patient: Patient,
  facilityId: string,
  getOrgIdExcludeList: () => Promise<string[]>
): Promise<void> {
  let commonWell: CommonWellAPI | undefined;
  try {
    const { log, debug } = Util.out(`CW update - M patientId ${patient.id}`);

    if (!(await isCWEnabledForCx(patient.cxId))) {
      debug(`CW disabled for cx ${patient.cxId}, skipping...`);
      return undefined;
    }

    const updateData = await setupUpdate(patient, facilityId);
    if (!updateData) {
      capture.message("Could not find external data on Patient, creating it @ CW", {
        extra: { patientId: patient.id, context: updateContext },
      });
      await create(patient, facilityId, getOrgIdExcludeList);
      return;
    }
    const { queryMeta, commonwellPatient, commonwellPatientId, personId } = updateData;
    commonWell = updateData.commonWell;

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
        getOrgIdExcludeList,
      });
      return;
    }

    // Already has a matching person, so update that person's demographics as well
    const person = makePersonForPatient(commonwellPatient);
    try {
      try {
        const respPerson = await commonWell.updatePerson(queryMeta, person, personId);
        debug(`resp updatePerson: `, JSON.stringify(respPerson));

        if (!respPerson.enrolled) {
          const respReenroll = await commonWell.reenrollPerson(queryMeta, personId);
          debug(`resp reenrolPerson: `, JSON.stringify(respReenroll));
        }
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
      } catch (err: any) {
        if (err.response?.status !== 404) throw err;
        const subject = "Got 404 when trying to update person @ CW, trying to find/create it";
        log(`${subject} - CW Person ID ${personId}`);
        capture.message(subject, {
          extra: {
            commonwellPatientId,
            personId,
            cwReference: commonWell.lastReferenceHeader,
            context: updateContext,
          },
        });
        await findOrCreatePersonAndLink({
          commonWell,
          queryMeta,
          commonwellPatient,
          commonwellPatientId,
          patientRefLink,
          storeIds: getStoreIdsFn(patient.id, patient.cxId),
          getOrgIdExcludeList,
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
      const { hasLink, isLinkLola3Plus, strongIds } = await getLinkInfo({
        commonWell,
        queryMeta,
        person,
        personId,
        commonwellPatient,
        commonwellPatientId,
      });
      if (!hasLink || (!isLinkLola3Plus && strongIds.length > 0)) {
        const respLink = await commonWell.addPatientLink(
          queryMeta,
          personId,
          patientRefLink,
          // safe to get the first one, just need to match one of the person's strong IDs
          strongIds.length ? strongIds[0] : undefined
        );
        debug(`resp patientLink: `, JSON.stringify(respLink));
      }
    } catch (err) {
      log(
        `ERR - Failed to updgrade patient/person link - ` +
          `Patient @ CW: ${commonwellPatientId}, ` +
          `Person @ CW: ${personId}`
      );
      throw err;
    }

    await autoUpgradeNetworkLinks(
      commonWell,
      queryMeta,
      commonwellPatientId,
      personId,
      createContext,
      getOrgIdExcludeList
    );

    const scheduledDocQueryRequestId = getCWData(
      patient.data.externalData
    )?.scheduledDocQueryRequestId;

    if (scheduledDocQueryRequestId) {
      const resetPatient = await resetPatientScheduledDocQueryRequestId({ patient });

      await queryAndProcessDocuments({
        patient: resetPatient,
        requestId: scheduledDocQueryRequestId,
        getOrgIdExcludeList,
      });
    }
  } catch (error) {
    console.error(`Failed to update patient ${patient.id} @ CW: ${errorToString(error)}`);
    capture.error(error, {
      extra: {
        facilityId,
        patientId: patient.id,
        cwReference: commonWell?.lastReferenceHeader,
        context: updateContext,
        error,
      },
    });
    throw error;
  }
}

export async function remove(patient: Patient, facilityId: string): Promise<void> {
  let commonWell: CommonWellAPI | undefined;
  try {
    const { log, debug } = Util.out(`CW delete - M patientId ${patient.id}`);

    if (!(await isCWEnabledForCx(patient.cxId))) {
      debug(`CW disabled for cx ${patient.cxId}, skipping...`);
      return undefined;
    }

    const data = await setupUpdate(patient, facilityId);
    if (!data) {
      log("Could not find external data on Patient while deleting it @ CW, continuing...");
      return;
    }
    const { queryMeta, commonwellPatientId } = data;
    commonWell = data.commonWell;

    const resp = await commonWell.deletePatient(queryMeta, commonwellPatientId);
    debug(`resp deletePatient: `, JSON.stringify(resp));
  } catch (err) {
    console.error(`Failed to delete patient ${patient.id} @ CW: `, err);
    capture.error(err, {
      extra: {
        facilityId,
        patientId: patient.id,
        cwReference: commonWell?.lastReferenceHeader,
        context: deleteContext,
      },
    });
    throw err;
  }
}

export async function linkPatientToCW(
  patient: Patient,
  facilityId: string,
  getOrgIdExcludeList: () => Promise<string[]>
) {
  await update(patient, facilityId, getOrgIdExcludeList);
}

async function setupUpdate(
  patient: Patient,
  facilityId: string
): Promise<
  | {
      commonWell: CommonWellAPI;
      queryMeta: RequestMetadata;
      commonwellPatient: CommonwellPatient;
      commonwellPatientId: string;
      personId: string | undefined;
    }
  | undefined
> {
  const commonwellData = patient.data.externalData
    ? getCWData(patient.data.externalData)
    : undefined;
  if (!commonwellData) return undefined;
  const commonwellPatientId = commonwellData.patientId;
  const personId = commonwellData.personId;

  const { organization, facility } = await getPatientData(patient, facilityId);
  const orgName = organization.data.name;
  const orgOID = organization.oid;
  const facilityNPI = facility.data["npi"] as string; // TODO #414 move to strong type - remove `as string`

  const queryMeta = organizationQueryMeta(orgName, { npi: facilityNPI });
  const commonwellPatient = patientToCommonwell({ patient, orgName, orgOID });
  const commonWell = makeCommonWellAPI(orgName, oid(orgOID));

  return { commonWell, queryMeta, commonwellPatient, commonwellPatientId, personId };
}

async function findOrCreatePersonAndLink({
  commonWell,
  queryMeta,
  commonwellPatient,
  commonwellPatientId,
  patientRefLink,
  storeIds,
  getOrgIdExcludeList,
}: {
  commonWell: CommonWellAPI;
  queryMeta: RequestMetadata;
  commonwellPatient: CommonwellPatient;
  commonwellPatientId: string;
  patientRefLink: string;
  storeIds: StoreIdsFunction;
  getOrgIdExcludeList: () => Promise<string[]>;
}): Promise<string> {
  const { log, debug } = Util.out(
    `CW findOrCreatePersonAndLink - CW patientId ${commonwellPatientId}`
  );
  let findOrCreateResponse: FindOrCreatePersonResponse;
  try {
    findOrCreateResponse = await findOrCreatePerson({
      commonWell,
      queryMeta,
      commonwellPatient,
      commonwellPatientId,
    });
  } catch (err) {
    log(`Error calling findOrCreatePerson @ CW`);
    await storeIds({ commonwellPatientId, status: "failed" });
    throw err;
  }
  if (!findOrCreateResponse) throw new MetriportError("Programming error: unexpected state");
  const { personId, person } = findOrCreateResponse;

  await storeIds({ commonwellPatientId, personId, status: "completed" });

  // Link Person to Patient
  try {
    const strongIds = getMatchingStrongIds(person, commonwellPatient);

    const respLink = await commonWell.addPatientLink(
      queryMeta,
      personId,
      patientRefLink,
      // safe to get the first one, just need to match one of the person's strong IDs
      strongIds.length ? strongIds[0] : undefined
    );
    debug(`resp patientLink: `, JSON.stringify(respLink));
  } catch (err) {
    log(`Error linking Patient<>Person @ CW - personId: ${personId}`);
    throw err;
  }

  await autoUpgradeNetworkLinks(
    commonWell,
    queryMeta,
    commonwellPatientId,
    personId,
    createContext,
    getOrgIdExcludeList
  );

  return personId;
}

async function registerPatient({
  commonWell,
  queryMeta,
  commonwellPatient,
  storeIds,
}: {
  commonWell: CommonWellAPI;
  queryMeta: RequestMetadata;
  commonwellPatient: CommonwellPatient;
  storeIds: StoreIdsFunction;
}): Promise<{ commonwellPatientId: string; patientRefLink: string }> {
  const fnName = `CW registerPatient`;
  const debug = Util.debug(fnName);

  const respPatient = await commonWell.registerPatient(queryMeta, commonwellPatient);
  debug(`resp registerPatient: `, JSON.stringify(respPatient));

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
    await storeIds({ commonwellPatientId, status: "failed" });
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
  commonWell: CommonWellAPI;
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
  debug(`resp updatePatient: `, JSON.stringify(respUpdate));

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

async function getLinkInfo({
  commonWell,
  queryMeta,
  person,
  personId,
  commonwellPatient,
  commonwellPatientId,
}: {
  commonWell: CommonWellAPI;
  queryMeta: RequestMetadata;
  person: Person;
  personId: string;
  commonwellPatient: CommonwellPatient;
  commonwellPatientId: string;
}): Promise<{ hasLink: boolean; isLinkLola3Plus: boolean; strongIds: StrongId[] }> {
  const { debug } = Util.out(`CW getLinkInfo - CW patientId ${commonwellPatientId}`);

  const respLinks = await commonWell.getPatientLinks(queryMeta, personId);
  debug(`resp getPatientLinks: ${JSON.stringify(respLinks)}`);

  const linkToPatient = respLinks._embedded?.patientLink
    ? respLinks._embedded.patientLink.find(l =>
        l.patient ? l.patient.includes(commonwellPatientId) : false
      )
    : undefined;
  const strongIds = getMatchingStrongIds(person, commonwellPatient);
  const hasLink = Boolean(linkToPatient && linkToPatient.assuranceLevel);
  const isLinkLola3Plus = linkToPatient?.assuranceLevel
    ? [LOLA.level_3, LOLA.level_4]
        .map(level => level.toString())
        .includes(linkToPatient.assuranceLevel)
    : false;
  return { hasLink, isLinkLola3Plus, strongIds };
}
