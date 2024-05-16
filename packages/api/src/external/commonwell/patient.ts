import {
  CommonWellAPI,
  getIdTrailingSlash,
  LOLA,
  organizationQueryMeta,
  Patient as CommonwellPatient,
  Person,
  RequestMetadata,
  PatientNetworkLink,
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
import { capture } from "@metriport/core/util/notifications";
import { out } from "@metriport/core/util/log";
import {
  isCommonwellEnabled,
  isCWEnabledForCx,
  isEnhancedCoverageEnabledForCx,
} from "../aws/appConfig";
import { HieInitiator } from "../hie/get-hie-initiator";
import { resetPatientScheduledDocQueryRequestId } from "../hie/reset-scheduled-doc-query-request-id";
import { resetPatientScheduledPatientDiscoveryRequestId } from "../hie/reset-scheduled-patient-discovery-request-id";
import { LinkStatus } from "../patient-link";
import { makeCommonWellAPI } from "./api";
import { queryAndProcessDocuments } from "./document/document-query";
import { autoUpgradeNetworkLinks } from "./link/shared";
import { makePersonForPatient, patientToCommonwell } from "./patient-conversion";
import { updateCommonwellPatientAndPersonIds } from "./command/update-patient-and-person-ids";
import { updateCommenwellCqLinkStatus } from "./command/update-cq-link-status";
import { updatePatientDiscoveryStatus } from "./command/update-patient-discovery-status";
import {
  CQLinkStatus,
  findOrCreatePerson,
  getMatchingStrongIds,
  PatientDataCommonwell,
} from "./patient-shared";
import { getCwInitiator } from "./shared";
import { updateDemographics } from "./patient-demographics";

const createContext = "cw.patient.create";
const updateContext = "cw.patient.update";
const deleteContext = "cw.patient.delete";

export type PatientNetworkLinkAddress = PatientNetworkLink["details"]["address"][number];
export type ValidPatientNetworkLinkAddress = Omit<
  PatientNetworkLinkAddress,
  "line" | "city" | "state"
> & {
  line: [string, ...string[]];
  city: string;
  state: string;
};

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

export async function create(
  patient: Patient,
  facilityId: string,
  getOrgIdExcludeList: () => Promise<string[]>,
  requestId?: string,
  forceCWCreate = false
): Promise<void> {
  const { debug } = out(`CW create - M patientId ${patient.id}`);

  const usedRequestId = requestId ?? uuidv7();
  const cwCreateEnabled = await validateCWEnabled({
    cxId: patient.cxId,
    forceCW: forceCWCreate,
    debug,
  });

  if (cwCreateEnabled) {
    const updatedPatient = await updatePatientDiscoveryStatus({
      patient,
      status: "processing",
      requestId: usedRequestId,
      facilityId,
      startedAt: new Date(),
    });

    // intentionally async
    registerAndLinkPatientInCW(
      updatedPatient,
      facilityId,
      getOrgIdExcludeList,
      usedRequestId,
      debug
    ).catch(processAsyncError(createContext));
  }
}

export async function registerAndLinkPatientInCW(
  patient: Patient,
  facilityId: string,
  getOrgIdExcludeList: () => Promise<string[]>,
  requestId: string,
  debug: typeof console.log,
  initiator?: HieInitiator
): Promise<{ commonwellPatientId: string; commonwellPersonId: string } | undefined> {
  let commonWell: CommonWellAPI | undefined;

  try {
    // THOMAS: What is this?
    // Patients of cxs that not go through EC should have their status undefined so they're not picked up later
    // when we enable it
    if (
      (await isEnhancedCoverageEnabledForCx(patient.cxId)) ||
      !getCWData(patient.data.externalData)?.cqLinkStatus
    ) {
      await updateCommenwellCqLinkStatus({
        patient,
        cqLinkStatus: "unlinked",
      });
    }

    const { commonWell, queryMeta, commonwellPatient } = await setupCW(
      patient,
      facilityId,
      initiator
    );

    debug(`Registering this Patient: `, () => JSON.stringify(commonwellPatient, null, 2));

    const { commonwellPatientId, patientRefLink } = await registerCommonwellPatient({
      commonWell,
      queryMeta,
      commonwellPatient,
    });

    await updateCommonwellPatientAndPersonIds({
      patient,
      commonwellPatientId,
    });

    const findOrCreatePersonResponse = await findOrCreatePerson({
      commonWell,
      queryMeta,
      commonwellPatient,
      commonwellPatientId,
    });

    if (!findOrCreatePersonResponse) {
      throw new MetriportError("Programming error: unexpected state");
    }

    const { person: commonwellPerson, personId: commonwellPersonId } = findOrCreatePersonResponse;

    await updateCommonwellPatientAndPersonIds({
      patient,
      commonwellPersonId,
    });

    const strongIds = getMatchingStrongIds(commonwellPerson, commonwellPatient);
    const { hasLink, isLinkLola3Plus } = await getLinkInfo({
      commonWell,
      queryMeta,
      commonwellPersonId,
      commonwellPatientId,
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

    const networkLinks = await autoUpgradeNetworkLinks(
      commonWell,
      queryMeta,
      commonwellPatientId,
      commonwellPersonId,
      createContext,
      getOrgIdExcludeList
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
          pdLinks: networkLinks?.length ?? 0,
          duration: elapsedTimeFromNow(pdStartedAt),
        },
      });
    }

    if (networkLinks && networkLinks.length > 0) {
      await updateDemographics(patient, networkLinks, facilityId);
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

    return { commonwellPatientId, commonwellPersonId };
  } catch (error) {
    await updatePatientDiscoveryStatus({
      patient,
      status: "failed",
    });
    const msg = "Failure while creating patient @ CW";
    console.error(`${msg}. Patient ID: ${patient.id}. Cause: ${errorToString(error)}`);
    capture.error(msg, {
      extra: {
        facilityId,
        patientId: patient.id,
        cwReference: commonWell?.lastReferenceHeader,
        context: createContext,
        error,
      },
    });
    throw error;
  }
}

export async function update(
  patient: Patient,
  facilityId: string,
  getOrgIdExcludeList: () => Promise<string[]>,
  requestId?: string,
  forceCWUpdate = false
): Promise<void> {
  const { log, debug } = out(`CW update - M patientId ${patient.id}`);

  const usedRequestId = requestId ?? uuidv7();
  const cwUpdateEnabled = await validateCWEnabled({
    cxId: patient.cxId,
    forceCW: forceCWUpdate,
    debug,
  });

  if (cwUpdateEnabled) {
    const updatedPatient = await updatePatientDiscoveryStatus({
      patient,
      status: "processing",
      requestId: usedRequestId,
      facilityId,
      startedAt: new Date(),
    });

    // intentionally async
    updatePatientAndLinksInCw(
      updatedPatient,
      facilityId,
      getOrgIdExcludeList,
      usedRequestId,
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
): Promise<void> {
  let commonWell: CommonWellAPI | undefined;

  try {
    const commonwellData = getCWData(patient.data.externalData);
    const commonwellPatientId = commonwellData?.patientId;
    const commonwellPersonId = commonwellData?.personId;

    if (!commonwellPatientId || !commonwellPersonId) {
      const subject = "Could not find a CW Patient ID or CW Person ID, creating missing ids @ CW";
      log(subject);
      capture.message(subject, {
        extra: {
          patientId: patient.id,
          context: updateContext,
        },
        level: "info",
      });
      await create(patient, facilityId, getOrgIdExcludeList, undefined);
      return;
    }

    const { commonWell, queryMeta, commonwellPatient } = await setupCW(patient, facilityId);

    debug(`Updating this Patient: `, () => JSON.stringify(commonwellPatient, null, 2));

    const { patientRefLink } = await updateCommonWellPatient({
      commonWell,
      queryMeta,
      commonwellPatient,
      commonwellPatientId,
    });

    let commonwellPerson: Person | undefined;
    try {
      commonwellPerson = await updateAndEnrollPerson({
        commonWell,
        queryMeta,
        commonwellPatient,
        commonwellPatientId,
        commonwellPersonId,
      });
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } catch (err: any) {
      if (err.response?.status !== 404) throw err;
      const subject = "Got 404 when trying to update person @ CW, trying to find/create it @ CW";
      log(`${subject} - CW Person ID ${commonwellPersonId}`);
      capture.message(subject, {
        extra: {
          commonwellPatientId,
          commonwellPersonId,
          cwReference: commonWell.lastReferenceHeader,
          context: updateContext,
        },
        level: "info",
      });
      await create(patient, facilityId, getOrgIdExcludeList, undefined);
      return;
    }

    const strongIds = getMatchingStrongIds(commonwellPerson, commonwellPatient);
    const { hasLink, isLinkLola3Plus } = await getLinkInfo({
      commonWell,
      queryMeta,
      commonwellPersonId,
      commonwellPatientId,
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

    const networkLinks = await autoUpgradeNetworkLinks(
      commonWell,
      queryMeta,
      commonwellPatientId,
      commonwellPersonId,
      createContext,
      getOrgIdExcludeList
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
          pdLinks: networkLinks?.length ?? 0,
          duration: elapsedTimeFromNow(pdStartedAt),
        },
      });
    }

    if (networkLinks && networkLinks.length > 0) {
      await updateDemographics(patient, networkLinks, facilityId);
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
  } catch (error) {
    await updatePatientDiscoveryStatus({
      patient,
      status: "failed",
    });
    const msg = "Failure while updating patient @ CW";
    console.error(`${msg}. Patient ID: ${patient.id}. Cause: ${errorToString(error)}`);
    capture.error(msg, {
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

export async function remove(
  patient: Patient,
  facilityId: string,
  forceCWDelete = false
): Promise<void> {
  const { log, debug } = out(`CW delete - M patientId ${patient.id}`);

  const cwDeleteEnabled = await validateCWEnabled({
    cxId: patient.cxId,
    forceCW: forceCWDelete,
    debug,
  });

  if (cwDeleteEnabled) {
    let commonWell: CommonWellAPI | undefined;

    try {
      const commonwellData = getCWData(patient.data.externalData);
      const commonwellPatientId = commonwellData?.patientId;
      const commonwellPersonId = commonwellData?.personId;

      if (!commonwellPatientId || !commonwellPersonId) {
        const subject = "Could not find a CW Patient ID or CW Person ID, continuing...";
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

      const { commonWell, queryMeta, commonwellPatient } = await setupCW(patient, facilityId);

      debug(`Deleting this Patient: `, () => JSON.stringify(commonwellPatient, null, 2));

      const resp = await commonWell.deletePatient(queryMeta, commonwellPatientId);
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
}

async function validateCWEnabled({
  cxId,
  forceCW,
  debug,
}: {
  cxId: string;
  forceCW: boolean;
  debug: typeof console.log;
}): Promise<boolean> {
  const fnName = `CW validateCWEnabled`;
  const isSandbox = Config.isSandbox();

  if (forceCW || isSandbox) {
    debug(`${fnName} - CW forced, proceeding...`);
    return true;
  }

  try {
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
    }

    return true;
  } catch (error) {
    const msg = "Failure validating CW create enabled";
    console.error(`${msg}. Cause: ${errorToString(error)}`);
    capture.error(msg, {
      extra: {
        cxId,
        error,
      },
    });
    return false;
  }
}

async function setupCW(
  patient: Patient,
  facilityId: string,
  initiator?: HieInitiator
): Promise<{
  commonWell: CommonWellAPI;
  queryMeta: RequestMetadata;
  commonwellPatient: CommonwellPatient;
}> {
  const usedInitiator = initiator ?? (await getCwInitiator(patient, facilityId));
  const initiatorName = usedInitiator.name;
  const initiatorOid = usedInitiator.oid;

  const queryMeta = organizationQueryMeta(initiatorName, { npi: usedInitiator.npi });
  const commonwellPatient = patientToCommonwell({
    patient,
    orgName: initiatorName,
    orgOID: initiatorOid,
  });
  const commonWell = makeCommonWellAPI(initiatorName, addOidPrefix(initiatorOid));

  return { commonWell, queryMeta, commonwellPatient };
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

    await update(resetPatient, facilityId, getOrgIdExcludeList, scheduledPdRequestId);

    newPatientDiscovery = true;
  }
  return newPatientDiscovery;
}

async function registerCommonwellPatient({
  commonWell,
  queryMeta,
  commonwellPatient,
}: {
  commonWell: CommonWellAPI;
  queryMeta: RequestMetadata;
  commonwellPatient: CommonwellPatient;
}): Promise<{ commonwellPatientId: string; patientRefLink: string }> {
  const fnName = `CW registerCommonwellPatient`;
  const { debug } = out(fnName);

  const respPatient = await commonWell.registerPatient(queryMeta, commonwellPatient);
  debug(`resp registerPatient: `, JSON.stringify(respPatient));

  const commonwellPatientId = getIdTrailingSlash(respPatient);
  if (!commonwellPatientId) {
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
      `${msg}. Patient ID: ${commonwellPatientId} respPatient: ${JSON.stringify(respPatient)}`
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

async function updateCommonWellPatient({
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
  const fnName = `CW updateCommonWellPatient`;
  const { debug } = out(`${fnName} - CW patientId ${commonwellPatientId}`);

  const respUpdate = await commonWell.updatePatient(
    queryMeta,
    commonwellPatient,
    commonwellPatientId
  );
  debug(`resp updatePatient: `, JSON.stringify(respUpdate));

  const patientRefLink = respUpdate._links?.self?.href;
  if (!patientRefLink) {
    const msg = `${fnName} - Could not determine the patient ref link`;
    console.error(
      `${msg}. Patient ID: ${commonwellPatientId} respUpdate: ${JSON.stringify(respUpdate)}`
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

async function updateAndEnrollPerson({
  commonWell,
  queryMeta,
  commonwellPatient,
  commonwellPatientId,
  commonwellPersonId,
}: {
  commonWell: CommonWellAPI;
  queryMeta: RequestMetadata;
  commonwellPatient: CommonwellPatient;
  commonwellPatientId: string;
  commonwellPersonId: string;
}): Promise<Person> {
  const { debug } = out(`CW updateAndEnrollPerson - CW patientId ${commonwellPatientId}`);

  const person = makePersonForPatient(commonwellPatient);
  const respPerson = await commonWell.updatePerson(queryMeta, person, commonwellPersonId);
  debug(`resp updatePerson: `, JSON.stringify(respPerson));

  if (!respPerson.enrolled) {
    const respReenrolledPerson = await commonWell.reenrollPerson(queryMeta, commonwellPersonId);
    debug(`resp reenrollPerson: `, JSON.stringify(respReenrolledPerson));

    return respReenrolledPerson;
  }
  return respPerson;
}

async function getLinkInfo({
  commonWell,
  queryMeta,
  commonwellPersonId,
  commonwellPatientId,
}: {
  commonWell: CommonWellAPI;
  queryMeta: RequestMetadata;
  commonwellPersonId: string;
  commonwellPatientId: string;
}): Promise<{ hasLink: boolean; isLinkLola3Plus: boolean }> {
  const { debug } = out(`CW getLinkInfo - CW patientId ${commonwellPatientId}`);

  const respLinks = await commonWell.getPatientLinks(queryMeta, commonwellPersonId);
  debug(`resp getPatientLinks: ${JSON.stringify(respLinks)}`);

  const linkToPatient = respLinks._embedded.patientLink.find(link =>
    link.patient.includes(commonwellPatientId)
  );
  if (linkToPatient) {
    const isLinkLola3Plus = [LOLA.level_3, LOLA.level_4]
      .map(level => level.toString())
      .includes(linkToPatient.assuranceLevel);
    return { hasLink: true, isLinkLola3Plus };
  }
  return { hasLink: false, isLinkLola3Plus: false };
}
