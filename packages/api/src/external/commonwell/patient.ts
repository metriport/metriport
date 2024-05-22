import {
  CommonWellAPI,
  getIdTrailingSlash,
  LOLA,
  NetworkLink,
  organizationQueryMeta,
  Patient as CommonWellPatient,
  Person as CommonWellPerson,
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
import { resetPatientScheduledPatientDiscoveryRequestId } from "../hie/reset-scheduled-patient-discovery-request-id";
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
import { updateDemographics } from "./patient-demographics";
import {
  matchPersonsByDemo,
  matchPersonsByStrongIds,
  handleMultiplePersonMatches,
  singlePersonWithId as singleCommonWellPersonWithId,
  multiplePersonWithId as multipleCommonWellPersonWithId,
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

/*
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
  });

  if (cwCreateEnabled) {
    // intentionally async
    registerAndLinkPatientInCW({
      patient,
      facilityId,
      getOrgIdExcludeList,
      requestId: requestId ?? uuidv7(),
      debug,
      context: createContext,
    }).catch(processAsyncError(createContext));
  }
}

export async function registerAndLinkPatientInCW({
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
}): Promise<{ commonWellPatientId: string; commonWellPersonId: string }> {
  let commonWell: CommonWellAPI | undefined;

  try {
    const _initiator = initiator ?? (await getCwInitiator(patient, facilityId));
    const initiatorName = _initiator.name;
    const initiatorOid = _initiator.oid;
    const initiatorNpi = _initiator.npi;

    // Patients of cxs that not go through EC should have theis status undefined so they're not picked up later
    // when we enable it
    const cqLinkStatus = (await isEnhancedCoverageEnabledForCx(patient.cxId))
      ? "unlinked"
      : undefined;
    await updateCqLinkStatus({ patient, cqLinkStatus });

    commonWell = makeCommonWellAPI(initiatorName, addOidPrefix(initiatorOid));
    const queryMeta = organizationQueryMeta(initiatorName, { npi: initiatorNpi });
    const commonWellPatient = patientToCommonwell({
      patient,
      orgName: initiatorName,
      orgOID: initiatorOid,
    });

    debug(`Registering CommonWellPatient: `, () => JSON.stringify(commonWellPatient, null, 2));
    const { commonWellPatientId, patientRefLink } = await registerPatient({
      commonWell,
      queryMeta,
      commonWellPatient,
    });
    await updatePatientAndPersonIds({
      patient,
      commonWellPatientId,
    });
    const { commonWellPersonId, networkLinks } = await findOrCreatePersonAndLink({
      commonWell,
      queryMeta,
      commonWellPatient,
      commonWellPatientId,
      patientRefLink,
      patient,
      facilityId,
      getOrgIdExcludeList,
      debug,
      context,
    });
    await endPdFlowWrapper({
      numnNetworkLinksFound: networkLinks?.length ?? 0,
      patient,
      facilityId,
      getOrgIdExcludeList,
      requestId,
      debug,
      context,
    });
    return { commonWellPatientId, commonWellPersonId };
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
  });
  if (cwUpdateEnabled) {
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
    const initiator = await getCwInitiator(patient, facilityId);
    const initiatorName = initiator.name;
    const initiatorOid = initiator.oid;
    const initiatorNpi = initiator.npi;

    commonWell = makeCommonWellAPI(initiatorName, addOidPrefix(initiatorOid));
    const queryMeta = organizationQueryMeta(initiatorName, { npi: initiatorNpi });
    const commonWellPatient = patientToCommonwell({
      patient,
      orgName: initiatorName,
      orgOID: initiatorOid,
    });

    const commonWellExternalData = getCWData(patient.data.externalData);
    const commonWellPatientId = commonWellExternalData?.patientId;
    if (!commonWellPatientId) {
      // Should we clear person ID to keep consistent state?
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

    debug(`Updating CommonWellPatient: `, () => JSON.stringify(commonWellPatient, null, 2));
    const { patientRefLink } = await updatePatient({
      commonWell,
      queryMeta,
      commonWellPatient,
      commonWellPatientId,
    });

    const commonWellPersonId = commonWellExternalData?.personId;
    let networkLinks: NetworkLink[] | undefined;
    if (!commonWellPersonId) {
      const { networkLinks: networkLinks1 } = await findOrCreatePersonAndLink({
        commonWell,
        queryMeta,
        commonWellPatient,
        commonWellPatientId,
        patientRefLink,
        patient,
        facilityId,
        getOrgIdExcludeList,
        debug,
        context,
      });
      networkLinks = networkLinks1;
    } else {
      /*
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
      // Moved into function
      networkLinks = await updatePersonAndLink({
        commonWell,
        queryMeta,
        commonWellPatient,
        commonWellPatientId,
        commonWellPersonId,
        patientRefLink,
        patient,
        facilityId,
        getOrgIdExcludeList,
        debug,
        context,
      });
    }
    await endPdFlowWrapper({
      numnNetworkLinksFound: networkLinks?.length ?? 0,
      patient,
      facilityId,
      getOrgIdExcludeList,
      requestId,
      debug,
      context,
    });
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
}: {
  patient: Patient;
  facilityId: string;
  forceCw: boolean;
  debug: typeof console.log;
}): Promise<boolean> {
  const fnName = `CW validateCWEnabled`;
  const { cxId } = patient;
  const isSandbox = Config.isSandbox();

  if (forceCw || isSandbox) {
    // Is this still needed?
    debug(`${fnName} - CW forced, proceeding...`);
    return true;
  }

  try {
    const isCwQueryEnabled = await isFacilityEnabledToQueryCW(facilityId, patient);
    const isCWEnabled = await isCommonwellEnabled();
    const isEnabledForCx = await isCWEnabledForCx(cxId);

    const cwIsDisabled = !isCWEnabled;
    const cwIsDisabledForCx = !isEnabledForCx;

    if (cwIsDisabledForCx) {
      debug(`${fnName} - CW disabled for cx ${cxId}, skipping...`);
      return false;
    } else if (cwIsDisabled) {
      debug(`${fnName} - CW not enabled, skipping...`);
      return false;
    } else if (!isCwQueryEnabled) {
      debug(`${fnName} - CW not enabled for query, skipping...`);
      return false;
    }

    return true;
  } catch (error) {
    const msg = `${fnName} - Error validating CW create/update/delete enabled`;
    debug(`${msg} - ${errorToString(error)}`);
    capture.error(msg, {
      extra: {
        cxId,
        forceCw,
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
      forceCw: false,
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

    const initiator = await getCwInitiator(patient, facilityId);
    const initiatorName = initiator.name;
    const initiatorOid = initiator.oid;
    const initiatorNpi = initiator.npi;

    commonWell = makeCommonWellAPI(initiatorName, addOidPrefix(initiatorOid));
    const queryMeta = organizationQueryMeta(initiatorName, { npi: initiatorNpi });
    const commonWellPatient = patientToCommonwell({
      patient,
      orgName: initiatorName,
      orgOID: initiatorOid,
    });

    const commonWellExternalData = getCWData(patient.data.externalData);
    const commonWellPatientId = commonWellExternalData?.patientId;
    if (!commonWellPatientId) {
      // Should we clear person ID to keep consistent state?
      const subject = "Could not find a CW Patient ID, continuing...";
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

    debug(`Deleting CommonWellPatient: `, () => JSON.stringify(commonWellPatient, null, 2));
    const resp = await commonWell.deletePatient(queryMeta, commonWellPatientId);
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

/*
export async function linkPatientToCW(
  patient: Patient,
  facilityId: string,
  getOrgIdExcludeList: () => Promise<string[]>
): Promise<void> {
  const requestId = uuidv7();

  await update(patient, facilityId, getOrgIdExcludeList, requestId);
}

async function setupUpdate(
  patient: Patient,
  facilityId: string
): Promise<
  | {
      commonWell: CommonWellAPI;
      queryMeta: RequestMetadata;
      commonwellPatient: CommomWellPatient;
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

  if (!commonwellPatientId || !personId) return undefined;

  const initiator = await getCwInitiator(patient, facilityId);
  const initiatorName = initiator.name;
  const initiatorOid = initiator.oid;

  const queryMeta = organizationQueryMeta(initiatorName, { npi: initiator.npi });
  const commonwellPatient = patientToCommonwell({
    patient,
    orgName: initiatorName,
    orgOID: initiatorOid,
  });
  const commonWell = makeCommonWellAPI(initiatorName, addOidPrefix(initiatorOid));

  return { commonWell, queryMeta, commonwellPatient, commonwellPatientId, personId };
}
*/

async function findOrCreatePersonAndLink({
  commonWell,
  queryMeta,
  commonWellPatient,
  commonWellPatientId,
  patientRefLink,
  patient,
  facilityId,
  getOrgIdExcludeList,
  debug,
  context,
}: {
  commonWell: CommonWellAPI;
  queryMeta: RequestMetadata;
  commonWellPatient: CommonWellPatient;
  commonWellPatientId: string;
  patientRefLink: string;
  patient: Patient;
  facilityId: string;
  getOrgIdExcludeList: () => Promise<string[]>;
  debug: typeof console.log;
  context: string;
}): Promise<{ commonWellPersonId: string; networkLinks: NetworkLink[] | undefined }> {
  debug(`Finding or creating CommonWellPerson for CommonWellPatient: `, () =>
    JSON.stringify(commonWellPatient, null, 2)
  );
  const { commonWellPerson, commonWellPersonId } = await findOrCreatePerson({
    commonWell,
    queryMeta,
    commonWellPatient,
    commonWellPatientId,
  });
  await updatePatientAndPersonIds({
    patient,
    commonWellPersonId,
  });
  debug(`Linking for CommonWellPerson: `, () => JSON.stringify(commonWellPerson, null, 2));
  const { hasLink, isLinkLola3Plus, strongIds } = await getLinkInfo({
    commonWell,
    queryMeta,
    commonWellPatientId,
    commonWellPatient,
    commonWellPersonId,
    commonWellPerson,
  });
  if (!hasLink || (!isLinkLola3Plus && strongIds.length > 0)) {
    const respLink = await commonWell.addPatientLink(
      queryMeta,
      commonWellPersonId,
      patientRefLink,
      // safe to get the first one, just need to match one of the person's strong IDs
      strongIds.length ? strongIds[0] : undefined
    );
    debug(`resp addPatientLink: `, JSON.stringify(respLink));
  }
  const networkLinks = await autoUpgradeNetworkLinks(
    commonWell,
    queryMeta,
    commonWellPatientId,
    commonWellPersonId,
    context,
    getOrgIdExcludeList
  );
  if (networkLinks && networkLinks.length > 0) {
    await updateDemographics(patient, networkLinks, facilityId);
  }
  return { commonWellPersonId, networkLinks };
}

async function updatePersonAndLink({
  commonWell,
  queryMeta,
  commonWellPatient,
  commonWellPatientId,
  commonWellPersonId,
  patientRefLink,
  patient,
  facilityId,
  getOrgIdExcludeList,
  debug,
  context,
}: {
  commonWell: CommonWellAPI;
  queryMeta: RequestMetadata;
  commonWellPatient: CommonWellPatient;
  commonWellPatientId: string;
  commonWellPersonId: string;
  patientRefLink: string;
  patient: Patient;
  facilityId: string;
  getOrgIdExcludeList: () => Promise<string[]>;
  debug: typeof console.log;
  context: string;
}): Promise<NetworkLink[] | undefined> {
  debug(`Updating and re-enrolling for CommonWellPerson for CommonWellPatient: `, () =>
    JSON.stringify(commonWellPatient, null, 2)
  );

  let commonWellPerson: CommonWellPerson | undefined;
  const tempCommonWellPerson = makePersonForPatient(commonWellPatient);
  try {
    const respPerson = await commonWell.updatePerson(
      queryMeta,
      tempCommonWellPerson,
      commonWellPersonId
    );
    debug(`resp updatePerson: `, JSON.stringify(respPerson));

    commonWellPerson = respPerson;
    if (!respPerson.enrolled) {
      const respReenroll = await commonWell.reenrollPerson(queryMeta, commonWellPersonId);
      debug(`resp reenrolPerson: `, JSON.stringify(respReenroll));
      commonWellPerson = respReenroll;
    }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } catch (err: any) {
    if (err.response?.status !== 404) throw err;
    const subject = "Got 404 when trying to update person @ CW, trying to find/create it @ CW";
    //log(`${subject} - CW CommonWellPerson ID ${commonWellPersonId}`);
    capture.message(subject, {
      extra: {
        commonWellPatientId,
        commonWellPersonId,
        cwReference: commonWell.lastReferenceHeader,
        context,
      },
      level: "info",
    });
    const { networkLinks } = await findOrCreatePersonAndLink({
      commonWell,
      queryMeta,
      commonWellPatient,
      commonWellPatientId,
      patientRefLink,
      patient,
      facilityId,
      getOrgIdExcludeList,
      debug,
      context,
    });
    return networkLinks;
  }
  debug(`Linking for CommonWellPerson: `, () => JSON.stringify(commonWellPerson, null, 2));
  const { hasLink, isLinkLola3Plus, strongIds } = await getLinkInfo({
    commonWell,
    queryMeta,
    commonWellPatient,
    commonWellPatientId,
    commonWellPerson,
    commonWellPersonId,
  });
  if (!hasLink || (!isLinkLola3Plus && strongIds.length > 0)) {
    const respLink = await commonWell.addPatientLink(
      queryMeta,
      commonWellPersonId,
      patientRefLink,
      // safe to get the first one, just need to match one of the person's strong IDs
      strongIds.length ? strongIds[0] : undefined
    );
    debug(`resp addPatientLink: `, JSON.stringify(respLink));
  }
  const networkLinks = await autoUpgradeNetworkLinks(
    commonWell,
    queryMeta,
    commonWellPatientId,
    commonWellPersonId,
    context,
    getOrgIdExcludeList
  );
  if (networkLinks && networkLinks.length > 0) {
    await updateDemographics(patient, networkLinks, facilityId);
  }
  return networkLinks;
}

async function registerPatient({
  commonWell,
  queryMeta,
  commonWellPatient,
}: {
  commonWell: CommonWellAPI;
  queryMeta: RequestMetadata;
  commonWellPatient: CommonWellPatient;
}): Promise<{ commonWellPatientId: string; patientRefLink: string }> {
  const fnName = `CW registerPatient`;
  const { debug } = out(fnName);

  const respPatient = await commonWell.registerPatient(queryMeta, commonWellPatient);
  debug(`resp registerPatient: `, JSON.stringify(respPatient));

  const commonWellPatientId = getIdTrailingSlash(respPatient);
  if (!commonWellPatientId) {
    const msg = `${fnName} - Could not determine the patient ID from CW`;
    console.error(`${msg}. respPatient: ${JSON.stringify(respPatient)}`);
    capture.error(msg, {
      extra: {
        respPatient,
      },
    });
    throw new Error(msg);
  }

  const patientRefLink = respPatient._links?.self?.href;
  if (!patientRefLink) {
    const msg = `${fnName} - Could not determine the patient ref link`;
    console.error(
      `${msg}. Patient ID: ${commonWellPatientId} respPatient: ${JSON.stringify(respPatient)}`
    );
    capture.error(msg, {
      extra: {
        respPatient,
      },
    });
    throw new Error(msg);
  }
  return { commonWellPatientId, patientRefLink };
}

async function updatePatient({
  commonWell,
  queryMeta,
  commonWellPatient,
  commonWellPatientId,
}: {
  commonWell: CommonWellAPI;
  queryMeta: RequestMetadata;
  commonWellPatient: CommonWellPatient;
  commonWellPatientId: string;
}): Promise<{ patientRefLink: string }> {
  const fnName = `CW updatePatient`;
  const { debug } = out(`${fnName} - CW patientId ${commonWellPatientId}`);

  const respUpdate = await commonWell.updatePatient(
    queryMeta,
    commonWellPatient,
    commonWellPatientId
  );
  debug(`resp updatePatient: `, JSON.stringify(respUpdate));

  const patientRefLink = respUpdate._links?.self?.href;
  if (!patientRefLink) {
    const msg = `${fnName} - Could not determine the patient ref link`;
    console.error(
      `${msg}. Patient ID: ${commonWellPatientId} respUpdate: ${JSON.stringify(respUpdate)}`
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

async function findOrCreatePerson({
  commonWell,
  queryMeta,
  commonWellPatient,
  commonWellPatientId,
}: {
  commonWell: CommonWellAPI;
  queryMeta: RequestMetadata;
  commonWellPatient: CommonWellPatient;
  commonWellPatientId: string;
}): Promise<{ commonWellPersonId: string; commonWellPerson: CommonWellPerson }> {
  const fnName = `CW updatePatient`;
  const { debug } = out(`${fnName} - CW patientId ${commonWellPatientId}`);
  const baseContext = `cw.findOrCreatePerson`;

  const strongIds = commonWellPatient.details.identifier ?? [];
  if (strongIds.length > 0) {
    const persons = await matchPersonsByStrongIds({
      commonWell,
      queryMeta,
      strongIds,
      commonWellPatientId,
    });
    if (persons.length === 1) {
      const commonWellPerson = (persons as singleCommonWellPersonWithId)[0]; // There's gotta be a better way
      return { commonWellPersonId: commonWellPerson.personId, commonWellPerson };
    }
    if (persons.length > 1) {
      const { personId, person } = handleMultiplePersonMatches({
        commonWellPatientId,
        persons: persons as multipleCommonWellPersonWithId, // There's gotta be a better way
        context: baseContext + ".strongIds",
      });
      return { commonWellPersonId: personId, commonWellPerson: person };
    }
  }
  const persons = await matchPersonsByDemo({
    commonWell,
    queryMeta,
    commonWellPatientId,
  });
  const enrolledPersons = persons.filter(isEnrolled);
  if (enrolledPersons.length === 1) {
    const commonWellPerson = (enrolledPersons as singleCommonWellPersonWithId)[0]; // There's gotta be a better way
    return { commonWellPersonId: commonWellPerson.personId, commonWellPerson };
  }
  if (enrolledPersons.length > 1) {
    // TODO needs to be rewritten to return the one with most links
    // Update 2023-12-12: the above TODO may be deprecated, since we actually want to link to the earliest person - even if the one has more links, they could be a "duplicate" patient that'll be removed later
    const { personId, person } = handleMultiplePersonMatches({
      commonWellPatientId,
      persons: enrolledPersons as multipleCommonWellPersonWithId, // There's gotta be a better way
      context: baseContext + ".enrolled.demographics",
    });
    return { commonWellPersonId: personId, commonWellPerson: person };
  }
  const unenrolledPersons = persons.filter(isUnenrolled);
  if (unenrolledPersons.length === 1) {
    const commonWellPerson = (unenrolledPersons as singleCommonWellPersonWithId)[0]; // There's gotta be a better way
    await commonWell.reenrollPerson(queryMeta, commonWellPerson.personId);
    return { commonWellPersonId: commonWellPerson.personId, commonWellPerson };
  }
  if (unenrolledPersons.length > 1) {
    const { personId, person } = handleMultiplePersonMatches({
      commonWellPatientId,
      persons: unenrolledPersons as multipleCommonWellPersonWithId, // There's gotta be a better way
      context: baseContext + ".unenrolled.demographics",
    });
    await commonWell.reenrollPerson(queryMeta, personId);
    return { commonWellPersonId: personId, commonWellPerson: person };
  }

  const tempCommonWellPerson = makePersonForPatient(commonWellPatient);
  debug(`Enrolling this commonWellPerson: `, JSON.stringify(tempCommonWellPerson));
  const respEnroll = await commonWell.enrollPerson(queryMeta, tempCommonWellPerson);
  debug(`resp enrollPerson: `, JSON.stringify(respEnroll));
  const commonWellPersonId = getPersonId(respEnroll);
  if (!commonWellPersonId) {
    const msg = `${fnName} - Could not get person ID from CW response`;
    console.error(
      `${msg}. Patient ID: ${commonWellPatientId} respEnroll: ${JSON.stringify(respEnroll)}`
    );
    capture.error(msg, {
      extra: {
        respEnroll,
      },
    });
    throw new Error(msg);
  }
  return { commonWellPersonId, commonWellPerson: respEnroll };
}

async function getLinkInfo({
  commonWell,
  queryMeta,
  commonWellPatient,
  commonWellPatientId,
  commonWellPerson,
  commonWellPersonId,
}: {
  commonWell: CommonWellAPI;
  queryMeta: RequestMetadata;
  commonWellPatient: CommonWellPatient;
  commonWellPatientId: string;
  commonWellPerson: CommonWellPerson;
  commonWellPersonId: string;
}): Promise<{ hasLink: boolean; isLinkLola3Plus: boolean; strongIds: StrongId[] }> {
  const { debug } = out(`CW getLinkInfo - CW patientId ${commonWellPatientId}`);

  const respLinks = await commonWell.getPatientLinks(queryMeta, commonWellPersonId);
  debug(`resp getPatientLinks: ${JSON.stringify(respLinks)}`);

  const linkToPatient = respLinks._embedded.patientLink.find(l =>
    l.patient ? l.patient.includes(commonWellPatientId) : false
  );
  const strongIds = getMatchingStrongIds(commonWellPerson, commonWellPatient);
  const hasLink = Boolean(linkToPatient && linkToPatient.assuranceLevel);
  const isLinkLola3Plus = linkToPatient?.assuranceLevel
    ? [LOLA.level_3, LOLA.level_4]
        .map(level => level.toString())
        .includes(linkToPatient.assuranceLevel)
    : false;
  return { hasLink, isLinkLola3Plus, strongIds };
}

async function endPdFlowWrapper({
  numnNetworkLinksFound,
  patient,
  facilityId,
  getOrgIdExcludeList,
  requestId,
  debug,
  context,
}: {
  numnNetworkLinksFound: number;
  patient: Patient;
  facilityId: string;
  getOrgIdExcludeList: () => Promise<string[]>;
  requestId: string;
  debug: typeof console.log;
  context: string;
}): Promise<void> {
  debug(`Finishing Patient Discovery. Context: ${context} Patient: `, () =>
    JSON.stringify(patient, null, 2)
  );

  const pdStartedAt = getCWData(patient.data.externalData)?.pdStartedAt;
  if (pdStartedAt) {
    analytics({
      distinctId: patient.cxId,
      event: EventTypes.patientDiscovery,
      properties: {
        hie: MedicalDataSource.COMMONWELL,
        patientId: patient.id,
        requestId,
        pdLinks: numnNetworkLinksFound,
        duration: elapsedTimeFromNow(pdStartedAt),
      },
    });
  }

  const newPatientDiscovery = await patientDiscoveryIfScheduled(
    patient,
    facilityId,
    getOrgIdExcludeList
  );

  if (!newPatientDiscovery) {
    await updatePatientDiscoveryStatus({
      patient,
      status: "completed",
    });

    await queryDocsIfScheduled(patient, getOrgIdExcludeList);
  }
}
