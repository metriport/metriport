import {
  CommonWellAPI,
  getIdTrailingSlash,
  LOLA,
  NetworkLink,
  organizationQueryMeta,
  Patient as CommonwellPatient,
  Person as CommonwellPerson,
  RequestMetadata,
  StrongId,
  getPersonId,
  isEnrolled,
  isUnenrolled,
} from "@metriport/commonwell-sdk";
import { addOidPrefix } from "@metriport/core/domain/oid";
import { Patient, PatientExternalData } from "@metriport/core/domain/patient";
import { MedicalDataSource } from "@metriport/core/external/index";
import { processAsyncError } from "@metriport/core/util/error/shared";
import { uuidv7 } from "@metriport/core/util/uuid-v7";
import { elapsedTimeFromNow } from "@metriport/shared/common/date";
import { errorToString } from "@metriport/shared/common/error";
import { getPatientOrFail } from "../../command/medical/patient/get-patient";
import { analytics, EventTypes } from "../../shared/analytics";
import { Config } from "../../shared/config";
import { capture } from "@metriport/core/util/notifications";
import { out } from "@metriport/core/util/log";
import {
  isCommonwellEnabled,
  isCWEnabledForCx,
  isEnhancedCoverageEnabledForCx,
} from "../aws/appConfig";
import { HieInitiator } from "../hie/get-hie-initiator";
import { resetPatientScheduledDocQueryRequestId } from "../hie/reset-scheduled-doc-query-request-id";
import { LinkStatus } from "../patient-link";
import { makeCommonWellAPI } from "./api";
import { queryAndProcessDocuments } from "./document/document-query";
import { autoUpgradeNetworkLinks } from "./link/shared";
import { makePersonForPatient, patientToCommonwell } from "./patient-conversion";
import { updatePatientAndPersonIds } from "./command/update-patient-and-person-ids";
import { updateCqLinkStatus } from "./command/update-cq-link-status";
import { updatePatientDiscoveryStatus } from "./command/update-patient-discovery-status";
import { CQLinkStatus, getMatchingStrongIds, PatientDataCommonwell } from "./patient-shared";
import { getCwInitiator } from "./shared";
import { isFacilityEnabledToQueryCW } from "../commonwell/shared";
import { resetPatientScheduledPatientDiscoveryRequestId } from "../hie/reset-scheduled-patient-discovery-request-id";
import { updateDemographics } from "./patient-demographics";
import {
  matchPersonsByDemo,
  matchPersonsByStrongIds,
  handleMultiplePersonMatches,
  singlePersonWithId as singleCommonwellPersonWithId,
  multiplePersonWithId as multipleCommonwellPersonWithId,
} from "./person-shared";

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

/* Broke this function into separate commands -- removed from patient-shared
type StoreIdsAndStatusFunction = (params: {
  commonwellPatientId: string;
  personId?: string;
  status?: LinkStatus;
}) => Promise<void>;

function getStoreIdsAndStatusFn(
  patientId: string,
  cxId: string,
  cqLinkStatus?: CQLinkStatus
): StoreIdsAndStatusFunction {
  return async ({
    commonwellPatientId,
    personId,
    status,
  }: {
    commonwellPatientId: string;
    personId?: string;
    status?: LinkStatus;
  }): Promise<void> => {
    await setCommonwellIdsAndStatus({
      patientId,
      cxId,
      commonwellPatientId,
      commonwellPersonId: personId,
      commonwellStatus: status,
      cqLinkStatus,
    });
  };
}
*/

export async function create({
  patient,
  facilityId,
  getOrgIdExcludeList,
  requestId,
  forceCw = false,
}: {
  patient: Patient;
  facilityId: string;
  getOrgIdExcludeList: () => Promise<string[]>;
  requestId?: string;
  forceCw?: boolean;
}): Promise<void> {
  const { debug } = out(`CW create - M patientId ${patient.id}`);

  const cwCreateEnabled = await validateCWEnabled({
    patient,
    facilityId,
    forceCw,
    debug,
    context: createContext,
  });

  if (cwCreateEnabled) {
    /* Moved this function into actual workflow function
    await setPatientDiscoveryStatus({	
      patientId: patient.id,	
      cxId: patient.cxId,	
      status: "processing",	
    });
    */

    // intentionally async
    registerAndLinkPatientInCw({
      patient,
      facilityId,
      getOrgIdExcludeList,
      requestId: requestId ?? uuidv7(),
      debug,
      context: createContext,
    }).catch(processAsyncError(createContext));
  }
}

export async function registerAndLinkPatientInCw({
  patient,
  facilityId,
  getOrgIdExcludeList,
  requestId,
  initiator,
  debug,
  context,
}: {
  patient: Patient;
  facilityId: string;
  getOrgIdExcludeList: () => Promise<string[]>;
  requestId: string;
  initiator?: HieInitiator;
  debug: typeof console.log;
  context: string;
}): Promise<{ commonwellPatientId: string; commonwellPersonId: string }> {
  let commonWell: CommonWellAPI | undefined;

  try {
    await updatePatientDiscoveryStatus({
      patient,
      status: "processing",
      requestId,
      facilityId,
      startedAt: new Date(),
    });

    // Patients of cxs that not go through EC should have theis status undefined so they're not picked up later
    // when we enable it
    const cqLinkStatus = (await isEnhancedCoverageEnabledForCx(patient.cxId))
      ? "unlinked"
      : undefined;
    await updateCqLinkStatus({ patient, cqLinkStatus });

    const { commonWellAPI, queryMeta, commonwellPatient } = await setupUpdate({
      patient,
      facilityId,
      initiator,
    });
    commonWell = commonWellAPI;
    debug(`Registering this Patient: `, () => JSON.stringify(commonwellPatient, null, 2));
    const { commonwellPatientId, patientRefLink } = await registerPatient({
      commonWell,
      queryMeta,
      commonwellPatient,
      patient,
    });
    debug(`Finding or creating person for this Patient: `, () =>
      JSON.stringify(commonwellPatient, null, 2)
    );
    const { commonwellPersonId, networkLinks } = await findOrCreatePersonAndLink({
      commonWell,
      queryMeta,
      commonwellPatient,
      commonwellPatientId,
      patientRefLink,
      patient,
      facilityId,
      getOrgIdExcludeList,
      context,
    });
    const pdStartedAt = getCWData(patient.data.externalData)?.pdStartedAt;
    analytics({
      distinctId: patient.cxId,
      event: EventTypes.patientDiscovery,
      properties: {
        hie: MedicalDataSource.COMMONWELL,
        patientId: patient.id,
        requestId,
        pdLinks: networkLinks?.length ?? 0,
        duration: elapsedTimeFromNow(pdStartedAt),
      },
    });
    const newPatientDiscovery = await patientDiscoveryIfScheduled(
      patient,
      facilityId,
      getOrgIdExcludeList
    );
    if (!newPatientDiscovery) {
      await updatePatientDiscoveryStatus({ patient, status: "completed" });
      await queryDocsIfScheduled(patient, getOrgIdExcludeList);
    }
    return { commonwellPatientId, commonwellPersonId };
  } catch (error) {
    await updatePatientDiscoveryStatus({ patient, status: "failed" });
    const msg = "Failure while creating patient @ CW";
    console.error(`${msg}. Patient ID: ${patient.id}. Cause: ${errorToString(error)}`);
    capture.error(msg, {
      extra: {
        facilityId,
        patientId: patient.id,
        cwReference: commonWell?.lastReferenceHeader,
        context,
        error,
      },
    });
    throw error;
  }
}

export async function update({
  patient,
  facilityId,
  getOrgIdExcludeList,
  requestId,
  forceCw = false,
}: {
  patient: Patient;
  facilityId: string;
  getOrgIdExcludeList: () => Promise<string[]>;
  requestId?: string;
  forceCw?: boolean;
}): Promise<void> {
  const { log, debug } = out(`CW update - M patientId ${patient.id}`);

  const cwUpdateEnabled = await validateCWEnabled({
    patient,
    facilityId,
    forceCw,
    debug,
    context: updateContext,
  });
  if (cwUpdateEnabled) {
    /* Moved this function into actual workflow function
    await setPatientDiscoveryStatus({
      patientId: patient.id,
      cxId: patient.cxId,
      status: "processing",
    });
    */
    // intentionally async
    updatePatientAndLinksInCw({
      patient,
      facilityId,
      getOrgIdExcludeList,
      requestId: requestId ?? uuidv7(),
      debug,
      log,
      context: updateContext,
    }).catch(processAsyncError(updateContext));
  }
}

async function updatePatientAndLinksInCw({
  patient,
  facilityId,
  getOrgIdExcludeList,
  requestId,
  debug,
  log,
  context,
}: {
  patient: Patient;
  facilityId: string;
  getOrgIdExcludeList: () => Promise<string[]>;
  requestId: string;
  debug: typeof console.log;
  log: typeof console.log;
  context: string;
}): Promise<void> {
  let commonWell: CommonWellAPI | undefined;
  try {
    await updatePatientDiscoveryStatus({
      patient,
      status: "processing",
      requestId,
      facilityId,
      startedAt: new Date(),
    });

    const updateData = await checkUpdate({ patient });
    if (!updateData) {
      // Should we clear patient / person patrial state to keep state consistent?
      const subject = "Could not find external data on Patient, creating it @ CW";
      log(subject);
      capture.message(subject, {
        extra: {
          patientId: patient.id,
          context,
        },
        level: "info",
      });
      await create({ patient, facilityId, getOrgIdExcludeList });
      return;
    }
    const { commonwellPatientId, commonwellPersonId } = updateData;
    const { commonWellAPI, queryMeta, commonwellPatient } = await setupUpdate({
      patient,
      facilityId,
    });
    commonWell = commonWellAPI;
    debug(`Updating this Patient: `, () => JSON.stringify(commonwellPatient, null, 2));
    const { patientRefLink } = await updatePatient({
      commonWell,
      queryMeta,
      commonwellPatient,
      commonwellPatientId,
    });
    /* This is not necessary as we already check for missing commonwellPersonId within checkSetup / old setupUpdate

    // No person yet, try to find/create with new patient demographics

    if (!personId) {
      await findOrCreatePersonAndLink({
        commonWell,
        queryMeta,
        commonwellPatient,
        commonwellPatientId,
        patientRefLink,
        storeIdsAndStatus: getStoreIdsAndStatusFn(patient.id, patient.cxId),
        getOrgIdExcludeList,
      });
      return;
    }
    */
    /* Moved into function
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
          storeIdsAndStatus: getStoreIdsAndStatusFn(patient.id, patient.cxId),
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

    const networkLinks = await autoUpgradeNetworkLinks(
      commonWell,
      queryMeta,
      commonwellPatientId,
      personId,
      createContext,
      getOrgIdExcludeList
    );
    */
    debug(`Updating and enrolling person for this Patient: `, () =>
      JSON.stringify(commonwellPatient, null, 2)
    );
    const networkLinks = await updatePersonAndLink({
      commonWell,
      queryMeta,
      commonwellPatient,
      commonwellPatientId,
      commonwellPersonId,
      patientRefLink,
      patient,
      facilityId,
      getOrgIdExcludeList,
      context,
    });
    const pdStartedAt = getCWData(patient.data.externalData)?.pdStartedAt;
    analytics({
      distinctId: patient.cxId,
      event: EventTypes.patientDiscovery,
      properties: {
        hie: MedicalDataSource.COMMONWELL,
        patientId: patient.id,
        requestId,
        pdLinks: networkLinks?.length ?? 0,
        duration: elapsedTimeFromNow(pdStartedAt),
      },
    });
    const newPatientDiscovery = await patientDiscoveryIfScheduled(
      patient,
      facilityId,
      getOrgIdExcludeList
    );
    if (!newPatientDiscovery) {
      await updatePatientDiscoveryStatus({ patient, status: "completed" });
      await queryDocsIfScheduled(patient, getOrgIdExcludeList);
    }
  } catch (error) {
    await updatePatientDiscoveryStatus({ patient, status: "failed" });
    const msg = "Failure while updating patient @ CW";
    console.error(`${msg}. Patient ID: ${patient.id}. Cause: ${errorToString(error)}`);
    capture.error(msg, {
      extra: {
        facilityId,
        patientId: patient.id,
        cwReference: commonWell?.lastReferenceHeader,
        context,
        error,
      },
    });
    throw error;
  }
}

async function validateCWEnabled({
  patient,
  facilityId,
  forceCw,
  debug,
  context,
}: {
  patient: Patient;
  facilityId: string;
  forceCw: boolean;
  debug: typeof console.log;
  context: string;
}): Promise<boolean> {
  const { cxId } = patient;
  const isSandbox = Config.isSandbox();

  if (forceCw || isSandbox) {
    debug(`CW forced, proceeding...`);
    return true;
  }

  try {
    const isCwQueryEnabled = await isFacilityEnabledToQueryCW(facilityId, patient);
    const isCWEnabled = await isCommonwellEnabled();
    const isEnabledForCx = await isCWEnabledForCx(cxId);

    const cwIsDisabled = !isCWEnabled;
    const cwIsDisabledForCx = !isEnabledForCx;

    if (cwIsDisabledForCx) {
      debug(`CW disabled for cx ${cxId}, skipping...`);
      return false;
    } else if (cwIsDisabled) {
      debug(`CW not enabled, skipping...`);
      return false;
    } else if (!isCwQueryEnabled) {
      debug(`CW not enabled for query, skipping...`);
      return false;
    }

    return true;
  } catch (error) {
    const msg = `Error validating CW ${context} enabled`;
    debug(`${msg} - ${errorToString(error)}`);
    capture.error(msg, {
      extra: {
        cxId,
        error,
      },
    });
    return false;
  }
}

async function queryDocsIfScheduled(
  patient: Patient,
  getOrgIdExcludeList: () => Promise<string[]>
): Promise<void> {
  const updatedPatient = await getPatientOrFail(patient);

  const scheduledDocQueryRequestId = getCWData(
    updatedPatient.data.externalData
  )?.scheduledDocQueryRequestId;

  if (scheduledDocQueryRequestId) {
    const resetPatient = await resetPatientScheduledDocQueryRequestId({
      patient: updatedPatient,
      source: MedicalDataSource.COMMONWELL,
    });

    await queryAndProcessDocuments({
      patient: resetPatient,
      requestId: scheduledDocQueryRequestId,
      getOrgIdExcludeList,
    });
  }
}

async function patientDiscoveryIfScheduled(
  patient: Patient,
  facilityId: string,
  getOrgIdExcludeList: () => Promise<string[]>
): Promise<boolean> {
  const updatedPatient = await getPatientOrFail(patient);

  const scheduledPdRequestId = getCWData(updatedPatient.data.externalData)?.scheduledPdRequestId;

  let newPatientDiscovery = false;
  if (scheduledPdRequestId) {
    const resetPatient = await resetPatientScheduledPatientDiscoveryRequestId({
      patient: updatedPatient,
      source: MedicalDataSource.COMMONWELL,
    });

    await update({
      patient: resetPatient,
      facilityId,
      getOrgIdExcludeList,
      requestId: scheduledPdRequestId,
    });

    newPatientDiscovery = true;
  }
  return newPatientDiscovery;
}

export async function remove({
  patient,
  facilityId,
}: {
  patient: Patient;
  facilityId: string;
}): Promise<void> {
  let commonWell: CommonWellAPI | undefined;
  try {
    const { log, debug } = out(`CW delete - M patientId ${patient.id}`);

    if (!(await isCWEnabledForCx(patient.cxId))) {
      debug(`CW disabled for cx ${patient.cxId}, skipping...`);
      return undefined;
    }

    const updateData = await checkUpdate({ patient });
    if (!updateData) {
      // Should we clear patient / person patrial state to keep state consistent?
      const subject =
        "Could not find external data on Patient while deleting it @ CW, continuing...";
      log(subject);
      capture.message(subject, {
        extra: {
          patientId: patient.id,
          context: deleteContext,
        },
        level: "info",
      });
      return;
    }
    const { commonWellAPI, queryMeta, commonwellPatient } = await setupUpdate({
      patient,
      facilityId,
    });
    commonWell = commonWellAPI;
    debug(`Deleting this: `, () => JSON.stringify(commonwellPatient, null, 2));
    const resp = await commonWell.deletePatient(queryMeta, updateData.commonwellPatientId);
    debug(`resp deletePatient: `, JSON.stringify(resp));
  } catch (error) {
    const msg = `Failure while deleting patient ${patient.id} @ CW: `;
    console.error(`${msg}. Patient ID: ${patient.id}. Cause: ${errorToString(error)}`);
    capture.error(msg, {
      extra: {
        facilityId,
        patientId: patient.id,
        cwReference: commonWell?.lastReferenceHeader,
        context: deleteContext,
        error,
      },
    });
    throw error;
  }
}

/* Not needed
export async function linkPatientToCW(
  patient: Patient,
  facilityId: string,
  getOrgIdExcludeList: () => Promise<string[]>
): Promise<void> {
  const requestId = uuidv7();

  await update(patient, facilityId, getOrgIdExcludeList, requestId);
}
*/

async function checkUpdate({
  patient,
}: {
  patient: Patient;
}): Promise<{ commonwellPatientId: string; commonwellPersonId: string } | undefined> {
  const commonwellData = getCWData(patient.data.externalData);
  if (!commonwellData) return undefined;
  const commonwellPatientId = commonwellData.patientId;
  const commonwellPersonId = commonwellData.personId;
  if (!commonwellPatientId || !commonwellPersonId) return undefined;

  return { commonwellPatientId, commonwellPersonId };
}

async function setupUpdate({
  patient,
  facilityId,
  initiator,
}: {
  patient: Patient;
  facilityId: string;
  initiator?: HieInitiator;
}): Promise<{
  commonWellAPI: CommonWellAPI;
  queryMeta: RequestMetadata;
  commonwellPatient: CommonwellPatient;
}> {
  const _initiator = initiator ?? (await getCwInitiator(patient, facilityId));
  const initiatorName = _initiator.name;
  const initiatorOid = _initiator.oid;
  const initiatorNpi = _initiator.npi;

  const queryMeta = organizationQueryMeta(initiatorName, { npi: initiatorNpi });
  const commonwellPatient = patientToCommonwell({
    patient,
    orgName: initiatorName,
    orgOID: initiatorOid,
  });
  const commonWellAPI = makeCommonWellAPI(initiatorName, addOidPrefix(initiatorOid));

  return { commonWellAPI, queryMeta, commonwellPatient };
}

async function findOrCreatePersonAndLink({
  commonWell,
  queryMeta,
  commonwellPatient,
  commonwellPatientId,
  patientRefLink,
  patient,
  facilityId,
  getOrgIdExcludeList,
  context,
}: {
  commonWell: CommonWellAPI;
  queryMeta: RequestMetadata;
  commonwellPatient: CommonwellPatient;
  commonwellPatientId: string;
  patientRefLink: string;
  patient: Patient;
  facilityId: string;
  getOrgIdExcludeList: () => Promise<string[]>;
  context: string;
}): Promise<{ commonwellPersonId: string; networkLinks: NetworkLink[] | undefined }> {
  const fnName = `CW findOrCreatePersonAndLink`;
  const { debug } = out(`${fnName} - CW patientId ${commonwellPatientId}`);

  debug(`Finding or creating CommonwellPerson for CommonwellPatient: `, () =>
    JSON.stringify(commonwellPatient, null, 2)
  );
  const { commonwellPerson, commonwellPersonId } = await findOrCreatePerson({
    commonWell,
    queryMeta,
    commonwellPatient,
    commonwellPatientId,
  });

  await updatePatientAndPersonIds({ patient, commonwellPatientId, commonwellPersonId });

  debug(`Linking for CommonwellPerson: `, () => JSON.stringify(commonwellPerson, null, 2));
  const strongIds = getMatchingStrongIds(commonwellPerson, commonwellPatient);
  const respLink = await commonWell.addPatientLink(
    queryMeta,
    commonwellPersonId,
    patientRefLink,
    // safe to get the first one, just need to match one of the person's strong IDs
    strongIds.length ? strongIds[0] : undefined
  );
  debug(`resp addPatientLink: `, JSON.stringify(respLink));
  debug(`Upgrading links for CommonwellPerson: `, () => JSON.stringify(commonwellPerson, null, 2));
  const networkLinks = await autoUpgradeNetworkLinks(
    commonWell,
    queryMeta,
    commonwellPatientId,
    commonwellPersonId,
    context,
    getOrgIdExcludeList
  );
  if (networkLinks && networkLinks.length > 0) {
    await updateDemographics(patient, networkLinks, facilityId);
  }
  return { commonwellPersonId, networkLinks };
}

async function updatePersonAndLink({
  commonWell,
  queryMeta,
  commonwellPatient,
  commonwellPatientId,
  commonwellPersonId,
  patientRefLink,
  patient,
  facilityId,
  getOrgIdExcludeList,
  context,
}: {
  commonWell: CommonWellAPI;
  queryMeta: RequestMetadata;
  commonwellPatient: CommonwellPatient;
  commonwellPatientId: string;
  commonwellPersonId: string;
  patientRefLink: string;
  patient: Patient;
  facilityId: string;
  getOrgIdExcludeList: () => Promise<string[]>;
  context: string;
}): Promise<NetworkLink[] | undefined> {
  const fnName = `CW updatePersonAndLink`;
  const { log, debug } = out(`${fnName} - - CW patientId ${commonwellPatientId}`);

  debug(`Updating and re-enrolling CommonwellPerson for CommonwellPatient: `, () =>
    JSON.stringify(commonwellPatient, null, 2)
  );
  let commonwellPerson: CommonwellPerson | undefined;
  const person = makePersonForPatient(commonwellPatient);
  try {
    const respPerson = await commonWell.updatePerson(queryMeta, person, commonwellPersonId);
    debug(`resp updatePerson: `, JSON.stringify(respPerson));
    commonwellPerson = respPerson;

    if (!respPerson.enrolled) {
      const respReenroll = await commonWell.reenrollPerson(queryMeta, commonwellPersonId);
      debug(`resp reenrolPerson: `, JSON.stringify(respReenroll));
      commonwellPerson = respReenroll;
    }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } catch (err: any) {
    if (err.response?.status !== 404) throw err;
    const subject = "Got 404 when trying to update person @ CW, trying to find/create it @ CW";
    log(`${subject} - CW CommonwellPerson ID ${commonwellPersonId}`);
    capture.message(subject, {
      extra: {
        commonwellPatientId,
        commonwellPersonId,
        cwReference: commonWell.lastReferenceHeader,
        context,
      },
      level: "info",
    });
    const { networkLinks } = await findOrCreatePersonAndLink({
      commonWell,
      queryMeta,
      commonwellPatient,
      commonwellPatientId,
      patientRefLink,
      patient,
      facilityId,
      getOrgIdExcludeList,
      context,
    });
    return networkLinks;
  }
  debug(`Linking for CommonwellPerson: `, () => JSON.stringify(commonwellPerson, null, 2));
  const { hasLink, isLinkLola3Plus, strongIds } = await getLinkInfo({
    commonWell,
    queryMeta,
    commonwellPatient,
    commonwellPatientId,
    commonwellPerson,
    commonwellPersonId,
  });
  if (!hasLink || (!isLinkLola3Plus && strongIds.length > 0)) {
    const respLink = await commonWell.addPatientLink(
      queryMeta,
      commonwellPersonId,
      patientRefLink,
      // safe to get the first one, just need to match one of the person's strong IDs
      strongIds.length ? strongIds[0] : undefined
    );
    debug(`resp addPatientLink: `, JSON.stringify(respLink));
  }
  debug(`Upgrading links for CommonwellPerson: `, () => JSON.stringify(commonwellPerson, null, 2));
  const networkLinks = await autoUpgradeNetworkLinks(
    commonWell,
    queryMeta,
    commonwellPatientId,
    commonwellPersonId,
    context,
    getOrgIdExcludeList
  );
  if (networkLinks && networkLinks.length > 0) {
    await updateDemographics(patient, networkLinks, facilityId);
  }
  return networkLinks;
}

async function findOrCreatePerson({
  commonWell,
  queryMeta,
  commonwellPatient,
  commonwellPatientId,
}: {
  commonWell: CommonWellAPI;
  queryMeta: RequestMetadata;
  commonwellPatient: CommonwellPatient;
  commonwellPatientId: string;
}): Promise<{ commonwellPersonId: string; commonwellPerson: CommonwellPerson }> {
  const fnName = `CW updatePatient`;
  const { debug } = out(`${fnName} - CW patientId ${commonwellPatientId}`);
  const baseContext = `cw.findOrCreatePerson`;

  const strongIds = commonwellPatient.details.identifier ?? [];
  if (strongIds.length > 0) {
    const persons = await matchPersonsByStrongIds({
      commonWell,
      queryMeta,
      strongIds,
      commonwellPatientId,
    });
    if (persons.length === 1) {
      const commonwellPerson = (persons as singleCommonwellPersonWithId)[0]; // There's gotta be a better way
      return { commonwellPersonId: commonwellPerson.personId, commonwellPerson };
    }
    if (persons.length > 1) {
      const { personId, person } = handleMultiplePersonMatches({
        commonwellPatientId,
        persons: persons as multipleCommonwellPersonWithId, // There's gotta be a better way
        context: baseContext + ".strongIds",
      });
      return { commonwellPersonId: personId, commonwellPerson: person };
    }
  }
  const persons = await matchPersonsByDemo({
    commonWell,
    queryMeta,
    commonwellPatientId,
  });
  const enrolledPersons = persons.filter(isEnrolled);
  if (enrolledPersons.length === 1) {
    const commonwellPerson = (enrolledPersons as singleCommonwellPersonWithId)[0]; // There's gotta be a better way
    return { commonwellPersonId: commonwellPerson.personId, commonwellPerson };
  }
  if (enrolledPersons.length > 1) {
    // TODO needs to be rewritten to return the one with most links
    // Update 2023-12-12: the above TODO may be deprecated, since we actually want to link to the earliest person - even if the one has more links, they could be a "duplicate" patient that'll be removed later
    const { personId, person } = handleMultiplePersonMatches({
      commonwellPatientId,
      persons: enrolledPersons as multipleCommonwellPersonWithId, // There's gotta be a better way
      context: baseContext + ".enrolled.demographics",
    });
    return { commonwellPersonId: personId, commonwellPerson: person };
  }
  const unenrolledPersons = persons.filter(isUnenrolled);
  if (unenrolledPersons.length === 1) {
    const commonwellPerson = (unenrolledPersons as singleCommonwellPersonWithId)[0]; // There's gotta be a better way
    await commonWell.reenrollPerson(queryMeta, commonwellPerson.personId);
    return { commonwellPersonId: commonwellPerson.personId, commonwellPerson };
  }
  if (unenrolledPersons.length > 1) {
    const { personId, person } = handleMultiplePersonMatches({
      commonwellPatientId,
      persons: unenrolledPersons as multipleCommonwellPersonWithId, // There's gotta be a better way
      context: baseContext + ".unenrolled.demographics",
    });
    await commonWell.reenrollPerson(queryMeta, personId);
    return { commonwellPersonId: personId, commonwellPerson: person };
  }

  const tempCommonwellPerson = makePersonForPatient(commonwellPatient);
  debug(`Enrolling this commonwellPerson: `, JSON.stringify(tempCommonwellPerson));
  const respEnroll = await commonWell.enrollPerson(queryMeta, tempCommonwellPerson);
  debug(`resp enrollPerson: `, JSON.stringify(respEnroll));
  const commonwellPersonId = getPersonId(respEnroll);
  if (!commonwellPersonId) {
    const msg = `${fnName} - Could not get person ID from CW response`;
    console.error(
      `${msg}. Patient ID: ${commonwellPatientId} respEnroll: ${JSON.stringify(respEnroll)}`
    );
    capture.error(msg, {
      extra: {
        respEnroll,
      },
    });
    throw new Error(msg);
  }
  return { commonwellPersonId, commonwellPerson: respEnroll };
}

async function registerPatient({
  commonWell,
  queryMeta,
  commonwellPatient,
  patient,
}: {
  commonWell: CommonWellAPI;
  queryMeta: RequestMetadata;
  commonwellPatient: CommonwellPatient;
  patient: Patient;
}): Promise<{ commonwellPatientId: string; patientRefLink: string }> {
  const fnName = `CW registerPatient`;
  const { debug } = out(fnName);

  const respPatient = await commonWell.registerPatient(queryMeta, commonwellPatient);
  debug(`resp registerPatient: `, JSON.stringify(respPatient));

  const commonwellPatientId = getIdTrailingSlash(respPatient);
  if (!commonwellPatientId) {
    const msg = "Could not determine the patient ID from CW";
    console.error(
      `${msg}. Patient created @ CW but not the Person. respPatient: ${JSON.stringify(respPatient)}`
    );
    capture.error(msg, {
      extra: {
        respPatient,
      },
    });
    throw new Error(msg);
  }

  await updatePatientAndPersonIds({ patient, commonwellPatientId });

  const patientRefLink = respPatient._links?.self?.href;
  if (!patientRefLink) {
    const msg = "Could not determine the patient ref link";
    console.error(
      `${msg}. Patient created @ CW but failed to get refLink. Patient ID: ${commonwellPatientId} respPatient: ${JSON.stringify(
        respPatient
      )}`
    );
    capture.error(msg, {
      extra: {
        respPatient,
      },
    });
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
  const fnName = `CW updatePatient`;
  const { debug } = out(`${fnName} - CW patientId ${commonwellPatientId}`);

  const respUpdate = await commonWell.updatePatient(
    queryMeta,
    commonwellPatient,
    commonwellPatientId
  );
  debug(`resp updatePatient: `, JSON.stringify(respUpdate));

  const patientRefLink = respUpdate._links?.self?.href;
  if (!patientRefLink) {
    const msg = "Could not determine the patient ref link";
    console.error(
      `${msg}. Patient updated @ CW but failed to get refLink. Patient ID: ${commonwellPatientId} respUpdate: ${JSON.stringify(
        respUpdate
      )}`
    );
    capture.error(msg, {
      extra: {
        respUpdate,
      },
    });
    throw new Error(msg);
  }
  return { patientRefLink };
}

async function getLinkInfo({
  commonWell,
  queryMeta,
  commonwellPatient,
  commonwellPatientId,
  commonwellPerson,
  commonwellPersonId,
}: {
  commonWell: CommonWellAPI;
  queryMeta: RequestMetadata;
  commonwellPatient: CommonwellPatient;
  commonwellPatientId: string;
  commonwellPerson: CommonwellPerson;
  commonwellPersonId: string;
}): Promise<{ hasLink: boolean; isLinkLola3Plus: boolean; strongIds: StrongId[] }> {
  const fnName = "CW getLinkInfo";
  const { debug } = out(`${fnName} - CW patientId ${commonwellPatientId}`);

  const respLinks = await commonWell.getPatientLinks(queryMeta, commonwellPersonId);
  debug(`resp getPatientLinks: ${JSON.stringify(respLinks)}`);

  const linkToPatient = respLinks._embedded.patientLink.find(l =>
    l.patient ? l.patient.includes(commonwellPatientId) : false
  );
  const strongIds = getMatchingStrongIds(commonwellPerson, commonwellPatient);
  const hasLink = Boolean(linkToPatient && linkToPatient.assuranceLevel);
  const isLinkLola3Plus = linkToPatient?.assuranceLevel
    ? [LOLA.level_3, LOLA.level_4]
        .map(level => level.toString())
        .includes(linkToPatient.assuranceLevel)
    : false;
  return { hasLink, isLinkLola3Plus, strongIds };
}
