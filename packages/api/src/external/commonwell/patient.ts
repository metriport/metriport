import {
  CommonWellAPI,
  getIdTrailingSlash,
  LOLA,
  NetworkLink,
  organizationQueryMeta,
  Patient as CommonwellPatient,
  Person,
  RequestMetadata,
  StrongId,
} from "@metriport/commonwell-sdk";
import { addOidPrefix } from "@metriport/core/domain/oid";
import { Patient, PatientExternalData } from "@metriport/core/domain/patient";
import { MedicalDataSource } from "@metriport/core/external/index";
import { processAsyncError } from "@metriport/core/util/error/shared";
import { uuidv7 } from "@metriport/core/util/uuid-v7";
import { elapsedTimeFromNow } from "@metriport/shared/common/date";
import { errorToString } from "@metriport/shared/common/error";
import { getPatientOrFail } from "../../command/medical/patient/get-patient";
import MetriportError from "../../errors/metriport-error";
import { analytics, EventTypes } from "../../shared/analytics";
import { Config } from "../../shared/config";
import { capture } from "../../shared/notifications";
import { Util } from "../../shared/util";
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
import { setCommonwellIdsAndStatus, setPatientDiscoveryStatus } from "./patient-external-data";
import {
  CQLinkStatus,
  findOrCreatePerson,
  FindOrCreatePersonResponse,
  getMatchingStrongIds,
  PatientDataCommonwell,
} from "./patient-shared";
import { getCwInitiator } from "./shared";
import { isFacilityEnabledToQueryCW } from "../commonwell/shared";

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

export async function create(
  patient: Patient,
  facilityId: string,
  getOrgIdExcludeList: () => Promise<string[]>,
  requestId?: string,
  forceCWCreate = false
): Promise<void> {
  const { debug } = Util.out(`CW create - M patientId ${patient.id}`);

  const cwCreateEnabled = await validateCWEnabled({
    patient,
    facilityId,
    forceCW: forceCWCreate,
    debug,
  });

  if (cwCreateEnabled) {
    await setPatientDiscoveryStatus({
      patientId: patient.id,
      cxId: patient.cxId,
      status: "processing",
    });

    // intentionally async
    registerAndLinkPatientInCW(patient, facilityId, getOrgIdExcludeList, debug, requestId).catch(
      processAsyncError(createContext)
    );
  }
}

export async function registerAndLinkPatientInCW(
  patient: Patient,
  facilityId: string,
  getOrgIdExcludeList: () => Promise<string[]>,
  debug: typeof console.log,
  requestId?: string,
  initiator?: HieInitiator
): Promise<{ commonwellPatientId: string; personId: string } | undefined> {
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
    const storeIdsAndStatus = getStoreIdsAndStatusFn(patient.id, patient.cxId, cqLinkStatus);

    commonWell = makeCommonWellAPI(initiatorName, addOidPrefix(initiatorOid));
    const queryMeta = organizationQueryMeta(initiatorName, { npi: initiatorNpi });
    const commonwellPatient = patientToCommonwell({
      patient,
      orgName: initiatorName,
      orgOID: initiatorOid,
    });
    debug(`Registering this Patient: `, () => JSON.stringify(commonwellPatient, null, 2));

    const { commonwellPatientId, patientRefLink } = await registerPatient({
      commonWell,
      queryMeta,
      commonwellPatient,
      storeIdsAndStatus,
    });

    const { personId, networkLinks } = await findOrCreatePersonAndLink({
      commonWell,
      queryMeta,
      commonwellPatient,
      commonwellPatientId,
      patientRefLink,
      storeIdsAndStatus,
      getOrgIdExcludeList,
    });

    if (requestId) {
      const startedAt = patient.data.patientDiscovery?.startedAt;

      analytics({
        distinctId: patient.cxId,
        event: EventTypes.patientDiscovery,
        properties: {
          hie: MedicalDataSource.COMMONWELL,
          patientId: patient.id,
          requestId,
          pdLinks: networkLinks?.length ?? 0,
          duration: elapsedTimeFromNow(startedAt),
        },
      });
    }

    await queryDocsIfScheduled(patient, getOrgIdExcludeList);

    return { commonwellPatientId, personId };
  } catch (error) {
    setPatientDiscoveryStatus({
      patientId: patient.id,
      cxId: patient.cxId,
      status: "failed",
    });

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
  getOrgIdExcludeList: () => Promise<string[]>,
  requestId: string,
  forceCWUpdate = false
): Promise<void> {
  const { log, debug } = Util.out(`CW update - M patientId ${patient.id}`);

  const cwUpdateEnabled = await validateCWEnabled({
    patient,
    facilityId,
    forceCW: forceCWUpdate,
    debug,
  });

  if (cwUpdateEnabled) {
    await setPatientDiscoveryStatus({
      patientId: patient.id,
      cxId: patient.cxId,
      status: "processing",
    });

    // intentionally async
    updatePatientAndLinksInCw(
      patient,
      facilityId,
      getOrgIdExcludeList,
      requestId,
      log,
      debug
    ).catch(processAsyncError(updateContext));
  }
}

async function updatePatientAndLinksInCw(
  patient: Patient,
  facilityId: string,
  getOrgIdExcludeList: () => Promise<string[]>,
  requestId: string,
  log: typeof console.log,
  debug: typeof console.log
) {
  let commonWell: CommonWellAPI | undefined;
  try {
    const updateData = await setupUpdate(patient, facilityId);
    if (!updateData) {
      capture.message("Could not find external data on Patient, creating it @ CW", {
        extra: { patientId: patient.id, context: updateContext },
      });
      await create(patient, facilityId, getOrgIdExcludeList, undefined);
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
        storeIdsAndStatus: getStoreIdsAndStatusFn(patient.id, patient.cxId),
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

    setPatientDiscoveryStatus({
      patientId: patient.id,
      cxId: patient.cxId,
      status: "completed",
    });

    const startedAt = patient.data.patientDiscovery?.startedAt;

    analytics({
      distinctId: patient.cxId,
      event: EventTypes.patientDiscovery,
      properties: {
        hie: MedicalDataSource.COMMONWELL,
        patientId: patient.id,
        requestId,
        pdLinks: networkLinks?.length ?? 0,
        duration: elapsedTimeFromNow(startedAt),
      },
    });

    await queryDocsIfScheduled(patient, getOrgIdExcludeList);
  } catch (error) {
    setPatientDiscoveryStatus({
      patientId: patient.id,
      cxId: patient.cxId,
      status: "failed",
    });
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

async function validateCWEnabled({
  patient,
  facilityId,
  forceCW,
  debug,
}: {
  patient: Patient;
  facilityId: string;
  forceCW: boolean;
  debug: typeof console.log;
}): Promise<boolean> {
  const { cxId } = patient;
  const isSandbox = Config.isSandbox();

  if (forceCW || isSandbox) {
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
    const msg = `Error validating CW create enabled`;
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

async function findOrCreatePersonAndLink({
  commonWell,
  queryMeta,
  commonwellPatient,
  commonwellPatientId,
  patientRefLink,
  storeIdsAndStatus,
  getOrgIdExcludeList,
}: {
  commonWell: CommonWellAPI;
  queryMeta: RequestMetadata;
  commonwellPatient: CommonwellPatient;
  commonwellPatientId: string;
  patientRefLink: string;
  storeIdsAndStatus: StoreIdsAndStatusFunction;
  getOrgIdExcludeList: () => Promise<string[]>;
}): Promise<{ personId: string; networkLinks: NetworkLink[] | undefined }> {
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
    await storeIdsAndStatus({ commonwellPatientId, status: "failed" });
    throw err;
  }
  if (!findOrCreateResponse) throw new MetriportError("Programming error: unexpected state");
  const { personId, person } = findOrCreateResponse;

  await storeIdsAndStatus({ commonwellPatientId, personId, status: "completed" });

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

  const networkLinks = await autoUpgradeNetworkLinks(
    commonWell,
    queryMeta,
    commonwellPatientId,
    personId,
    createContext,
    getOrgIdExcludeList
  );

  return { personId, networkLinks };
}

async function registerPatient({
  commonWell,
  queryMeta,
  commonwellPatient,
  storeIdsAndStatus,
}: {
  commonWell: CommonWellAPI;
  queryMeta: RequestMetadata;
  commonwellPatient: CommonwellPatient;
  storeIdsAndStatus: StoreIdsAndStatusFunction;
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

  await storeIdsAndStatus({ commonwellPatientId });

  const patientRefLink = respPatient._links?.self?.href;
  if (!patientRefLink) {
    const msg = `Could not determine the patient ref link`;
    log(
      `ERR - ${msg} - Patient created @ CW but not the Person - ` +
        `Patient @ Commonwell: ${JSON.stringify(respPatient)}`
    );
    await storeIdsAndStatus({ commonwellPatientId, status: "failed" });
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
