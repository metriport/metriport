import {
  CommonWellAPI,
  getIdTrailingSlash,
  LOLA,
  organizationQueryMeta,
  Patient as CommonwellPatient,
  Person,
  RequestMetadata,
  NetworkLink,
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

export type cwCreateProps = {
  patient: Patient;
  facilityId: string;
  getOrgIdExcludeList: () => Promise<string[]>;
  forceCW: boolean;
  requestId?: string;
  initiator?: HieInitiator;
};

export type cwUpdateProps = cwCreateProps;
export type cwRemoveProps = cwCreateProps;

type cwCreateFlowProps = Omit<cwCreateProps, "forceCW" | "requestId"> & {
  requestId: string;
  debug: typeof console.log;
  log: typeof console.log;
  context: string;
};

type cwUpdateFlowProps = cwCreateFlowProps;
type cwDeleteFlowProps = Omit<cwCreateFlowProps, "requestId">;

type cwSdkProps = {
  commonWell: CommonWellAPI;
  queryMeta: RequestMetadata;
  commonwellPatient: CommonwellPatient;
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

export async function create(cwCreateProps: cwCreateProps): Promise<void> {
  const { patient, forceCW, requestId, initiator } = cwCreateProps;
  const { debug, log } = out(`CW create - M patientId ${patient.id}`);

  const cwEnabled = await validateCWEnabled({ cxId: patient.cxId, forceCW, debug });
  if (cwEnabled) {
    // intentionally async
    runCreateFlow({
      ...cwCreateProps,
      requestId: requestId ?? uuidv7(),
      debug,
      log,
      context: createContext,
      initiator,
    }).catch(processAsyncError(createContext));
  }
}

export async function update(cwUpdateProps: cwUpdateProps): Promise<void> {
  const { patient, forceCW, requestId, initiator } = cwUpdateProps;
  const { debug, log } = out(`CW update - M patientId ${patient.id}`);

  const cwEnabled = await validateCWEnabled({ cxId: patient.cxId, forceCW, debug });
  if (cwEnabled) {
    // intentionally async
    runUpdateFlow({
      ...cwUpdateProps,
      requestId: requestId ?? uuidv7(),
      debug,
      log,
      context: updateContext,
      initiator,
    }).catch(processAsyncError(updateContext));
  }
}

export async function remove(cwRemoveProps: cwRemoveProps): Promise<void> {
  const { patient, forceCW, initiator } = cwRemoveProps;
  const { debug, log } = out(`CW delete - M patientId ${patient.id}`);

  const cwEnabled = await validateCWEnabled({ cxId: patient.cxId, forceCW, debug });
  if (cwEnabled) {
    // intentionally async
    runRemoveFlow({
      ...cwRemoveProps,
      debug,
      log,
      context: deleteContext,
      initiator,
    }).catch(processAsyncError(deleteContext));
  }
}

// Flows
export async function runCreateFlow(
  cwCreateFlowProps: cwCreateFlowProps
): Promise<{ commonwellPatientId: string; commonwellPersonId: string }> {
  let commonWell: CommonWellAPI | undefined;
  const { patient, facilityId } = cwCreateFlowProps;
  // THOMAS: Remove?
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

  try {
    const cwSdkProps = await startPdFlowWrapper(cwCreateFlowProps);
    commonWell = cwSdkProps.commonWell;
    const { commonwellPatientId, patientRefLink } = await registerPatientWrapper({
      ...cwSdkProps,
      ...cwCreateFlowProps,
    });
    const { commonwellPerson, commonwellPersonId } = await findOrCreatePersonWrapper({
      ...cwSdkProps,
      ...cwCreateFlowProps,
      commonwellPatientId,
    });
    const { networkLinks } = await linkPersonWrapper({
      ...cwSdkProps,
      ...cwCreateFlowProps,
      commonwellPatientId,
      commonwellPerson,
      commonwellPersonId,
      patientRefLink,
    });
    await endPdFlowWrapper({
      ...cwCreateFlowProps,
      numnNetworkLinksFound: networkLinks?.length ?? 0,
    });
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
        context: cwCreateFlowProps.context,
        error,
      },
    });
    throw error;
  }
}

async function runUpdateFlow(cwUpdateFlowProps: cwUpdateFlowProps): Promise<void> {
  let commonWell: CommonWellAPI | undefined;
  const { patient, facilityId, log } = cwUpdateFlowProps;

  try {
    const cwSdkProps = await startPdFlowWrapper(cwUpdateFlowProps);
    commonWell = cwSdkProps.commonWell;
    const commonwellExternalData = getCWData(patient.data.externalData);
    const commonwellPatientId = commonwellExternalData?.patientId;
    if (!commonwellPatientId) {
      // Should be clear person ID to keep consistent state?
      const subject = "Could not find a CW Patient ID, creating missing ids @ CW";
      log(subject);
      capture.message(subject, {
        extra: {
          patientId: patient.id,
          context: cwUpdateFlowProps.context,
        },
        level: "info",
      });
      await runCreateFlow(cwUpdateFlowProps);
      return;
    }
    const { patientRefLink } = await updatePatientWrapper({
      ...cwSdkProps,
      ...cwUpdateFlowProps,
      commonwellPatientId,
    });
    let commonwellPersonId = commonwellExternalData?.personId;
    let commonwellPerson = makePersonForPatient(cwSdkProps.commonwellPatient);
    if (!commonwellPersonId) {
      const perrson = await findOrCreatePersonWrapper({
        ...cwSdkProps,
        ...cwUpdateFlowProps,
        commonwellPatientId,
      });
      commonwellPersonId = perrson.commonwellPersonId;
      commonwellPerson = perrson.commonwellPerson;
    } else {
      await updateAndEnrollPersonWrapper({
        ...cwSdkProps,
        ...cwUpdateFlowProps,
        commonwellPatientId,
        commonwellPersonId,
      });
    }
    const { networkLinks } = await linkPersonWrapper({
      ...cwSdkProps,
      ...cwUpdateFlowProps,
      commonwellPatientId,
      commonwellPerson,
      commonwellPersonId,
      patientRefLink,
    });
    await endPdFlowWrapper({
      ...cwUpdateFlowProps,
      numnNetworkLinksFound: networkLinks?.length ?? 0,
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
        context: cwUpdateFlowProps.context,
        error,
      },
    });
    throw error;
  }
}

async function runRemoveFlow(cwDeleteFlowProps: cwDeleteFlowProps): Promise<void> {
  let commonWell: CommonWellAPI | undefined;
  const { patient, facilityId, log } = cwDeleteFlowProps;

  try {
    const cwSdkProps = await setupCwSdkProps(cwDeleteFlowProps);
    commonWell = cwSdkProps.commonWell;
    const commonwellExternalData = getCWData(patient.data.externalData);
    const commonwellPatientId = commonwellExternalData?.patientId;
    if (!commonwellPatientId) {
      // Should be clear person ID to keep consistent state?
      const subject = "Could not find a CW Patient ID, continuing...";
      log(subject);
      capture.message(subject, {
        extra: {
          patientId: patient.id,
          context: cwDeleteFlowProps.context,
        },
        level: "info",
      });
      return;
    }
    await deletePatientWrapper({
      ...cwSdkProps,
      ...cwDeleteFlowProps,
      commonwellPatientId,
    });
  } catch (error) {
    const msg = `Failure while deleting patient ${patient.id} @ CW: `;
    console.error(`${msg}. Patient ID: ${patient.id}. Cause: ${errorToString(error)}`);
    capture.error(msg, {
      extra: {
        facilityId,
        patientId: patient.id,
        cwReference: commonWell?.lastReferenceHeader,
        context: cwDeleteFlowProps.context,
        error,
      },
    });
    throw error;
  }
}

// Wrappers
async function registerPatientWrapper({
  commonWell,
  queryMeta,
  commonwellPatient,
  patient,
  debug,
}: {
  commonWell: CommonWellAPI;
  queryMeta: RequestMetadata;
  commonwellPatient: CommonwellPatient;
  patient: Patient;
  debug: typeof console.log;
}): Promise<{ commonwellPatientId: string; patientRefLink: string }> {
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

  return { commonwellPatientId, patientRefLink };
}

async function updatePatientWrapper({
  commonWell,
  queryMeta,
  commonwellPatient,
  commonwellPatientId,
  debug,
}: {
  commonWell: CommonWellAPI;
  queryMeta: RequestMetadata;
  commonwellPatient: CommonwellPatient;
  commonwellPatientId: string;
  debug: typeof console.log;
}): Promise<{ patientRefLink: string }> {
  debug(`Updating this Patient: `, () => JSON.stringify(commonwellPatient, null, 2));

  const { patientRefLink } = await updateCommonWellPatient({
    commonWell,
    queryMeta,
    commonwellPatient,
    commonwellPatientId,
  });

  return { patientRefLink };
}

async function deletePatientWrapper({
  commonWell,
  queryMeta,
  commonwellPatient,
  commonwellPatientId,
  debug,
}: {
  commonWell: CommonWellAPI;
  queryMeta: RequestMetadata;
  commonwellPatient: CommonwellPatient;
  commonwellPatientId: string;
  debug: typeof console.log;
}): Promise<void> {
  debug(`Deleting this Patient: `, () => JSON.stringify(commonwellPatient, null, 2));

  const resp = await commonWell.deletePatient(queryMeta, commonwellPatientId);
  debug(`resp deletePatient: `, JSON.stringify(resp));
}

async function findOrCreatePersonWrapper({
  commonWell,
  queryMeta,
  commonwellPatient,
  commonwellPatientId,
  patient,
  debug,
}: {
  commonWell: CommonWellAPI;
  queryMeta: RequestMetadata;
  commonwellPatient: CommonwellPatient;
  commonwellPatientId: string;
  patient: Patient;
  debug: typeof console.log;
}): Promise<{ commonwellPerson: Person; commonwellPersonId: string }> {
  debug(`Finding or creating for this Patient: `, () => JSON.stringify(commonwellPatient, null, 2));

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

  return { commonwellPerson, commonwellPersonId };
}

async function updateAndEnrollPersonWrapper({
  commonWell,
  queryMeta,
  commonwellPatient,
  commonwellPatientId,
  commonwellPersonId,
  patient,
  debug,
  log,
  context,
}: {
  commonWell: CommonWellAPI;
  queryMeta: RequestMetadata;
  commonwellPatient: CommonwellPatient;
  commonwellPatientId: string;
  commonwellPersonId: string;
  patient: Patient;
  debug: typeof console.log;
  log: typeof console.log;
  context: string;
}): Promise<void> {
  debug(`Updating and re-enrolling for this Patient: `, () =>
    JSON.stringify(commonwellPatient, null, 2)
  );

  try {
    await updateAndEnrollPerson({
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
        context,
      },
      level: "info",
    });
    await findOrCreatePersonWrapper({
      commonWell,
      queryMeta,
      commonwellPatient,
      commonwellPatientId,
      patient,
      debug,
    });
  }
}

async function linkPersonWrapper({
  commonWell,
  queryMeta,
  commonwellPatient,
  commonwellPatientId,
  commonwellPerson,
  commonwellPersonId,
  patient,
  patientRefLink,
  facilityId,
  getOrgIdExcludeList,
  debug,
  context,
}: {
  commonWell: CommonWellAPI;
  queryMeta: RequestMetadata;
  commonwellPatient: CommonwellPatient;
  commonwellPatientId: string;
  commonwellPerson: Person;
  commonwellPersonId: string;
  patient: Patient;
  patientRefLink: string;
  facilityId: string;
  getOrgIdExcludeList: () => Promise<string[]>;
  debug: typeof console.log;
  context: string;
}): Promise<{ networkLinks: NetworkLink[] | undefined }> {
  debug(`Linking for Person: `, () => JSON.stringify(commonwellPerson, null, 2));

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
    context,
    getOrgIdExcludeList
  );

  if (networkLinks && networkLinks.length > 0) {
    await updateDemographics(patient, networkLinks, facilityId);
  }

  return { networkLinks };
}

async function startPdFlowWrapper({
  patient,
  facilityId,
  requestId,
  debug,
  context,
  initiator,
}: {
  patient: Patient;
  facilityId: string;
  requestId: string;
  debug: typeof console.log;
  context: string;
  initiator?: HieInitiator;
}): Promise<cwSdkProps> {
  debug(`Starting Patient Discovery. Context: ${context} Patient: `, () =>
    JSON.stringify(patient, null, 2)
  );

  const updatedPatient = await updatePatientDiscoveryStatus({
    patient,
    status: "processing",
    requestId: requestId,
    facilityId,
    startedAt: new Date(),
  });

  return await setupCwSdkProps({
    patient: updatedPatient,
    facilityId,
    initiator,
  });
}

async function endPdFlowWrapper({
  numnNetworkLinksFound,
  requestId,
  patient,
  facilityId,
  getOrgIdExcludeList,
  debug,
  context,
}: {
  numnNetworkLinksFound: number;
  requestId: string;
  patient: Patient;
  facilityId: string;
  getOrgIdExcludeList: () => Promise<string[]>;
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

// Helpers
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

async function setupCwSdkProps({
  patient,
  facilityId,
  initiator,
}: {
  patient: Patient;
  facilityId: string;
  initiator?: HieInitiator;
}): Promise<cwSdkProps> {
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

    await update({
      patient: resetPatient,
      facilityId,
      getOrgIdExcludeList,
      forceCW: false,
      requestId: scheduledPdRequestId,
    });

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
}): Promise<void> {
  const { debug } = out(`CW updateAndEnrollPerson - CW patientId ${commonwellPatientId}`);

  const person = makePersonForPatient(commonwellPatient);
  const respPerson = await commonWell.updatePerson(queryMeta, person, commonwellPersonId);
  debug(`resp updatePerson: `, JSON.stringify(respPerson));

  if (!respPerson.enrolled) {
    const respReenrolledPerson = await commonWell.reenrollPerson(queryMeta, commonwellPersonId);
    debug(`resp reenrollPerson: `, JSON.stringify(respReenrolledPerson));
  }
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
