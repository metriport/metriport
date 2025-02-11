import {
  CommonWellAPI,
  getIdTrailingSlash,
  LOLA,
  NetworkLink,
  organizationQueryMeta,
  Patient as CommonwellPatient,
  RequestMetadata,
} from "@metriport/commonwell-sdk";
import { addOidPrefix } from "@metriport/core/domain/oid";
import { Patient, PatientExternalData } from "@metriport/core/domain/patient";
import { analytics, EventTypes } from "@metriport/core/external/analytics/posthog";
import { MedicalDataSource } from "@metriport/core/external/index";
import { processAsyncError } from "@metriport/core/util/error/shared";
import { out } from "@metriport/core/util/log";
import { capture } from "@metriport/core/util/notifications";
import { uuidv7 } from "@metriport/core/util/uuid-v7";
import { errorToString } from "@metriport/shared";
import { elapsedTimeFromNow } from "@metriport/shared/common/date";
import { getPatientOrFail } from "../../command/medical/patient/get-patient";
import {
  createAugmentedPatient,
  getNewDemographics,
} from "../../domain/medical/patient-demographics";
import MetriportError from "../../errors/metriport-error";
import { isEnhancedCoverageEnabledForCx, isDemoAugEnabledForCx } from "../aws/app-config";
import { checkLinkDemographicsAcrossHies } from "../hie/check-patient-link-demographics";
import { HieInitiator } from "../hie/get-hie-initiator";
import { resetPatientScheduledDocQueryRequestId } from "../hie/reset-scheduled-doc-query-request-id";
import { resetScheduledPatientDiscovery } from "../hie/reset-scheduled-patient-discovery-request";
import { setDocQueryProgress } from "../hie/set-doc-query-progress";
import { updatePatientLinkDemographics } from "../hie/update-patient-link-demographics";
import { LinkStatus } from "../patient-link";
import { makeCommonWellAPI } from "./api";
import { createOrUpdateCwPatientData } from "./command/cw-patient-data/create-cw-data";
import { deleteCwPatientData } from "./command/cw-patient-data/delete-cw-data";
import { updateCwPatientData } from "./command/cw-patient-data/update-cw-data";
import { CwLink } from "./cw-patient-data";
import { queryAndProcessDocuments } from "./document/document-query";
import { autoUpgradeNetworkLinks } from "./link/shared";
import { makePersonForPatient, patientToCommonwell } from "./patient-conversion";
import {
  getPatientNetworkLinks,
  patientNetworkLinkToNormalizedLinkDemographics,
} from "./patient-demographics";
import {
  updateCommonwellIdsAndStatus,
  updatePatientDiscoveryStatus,
} from "./patient-external-data";
import {
  CQLinkStatus,
  findOrCreatePerson,
  FindOrCreatePersonResponse,
  getMatchingStrongIds,
  PatientDataCommonwell,
} from "./patient-shared";
import { getCwInitiator, validateCWEnabled } from "./shared";

const createContext = "cw.patient.create";
const updateContext = "cw.patient.update";
const getContext = "cw.patient.get";
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

export async function create({
  patient,
  facilityId,
  getOrgIdExcludeList,
  requestId: inputRequestId,
  forceCWCreate = false,
  rerunPdOnNewDemographics = false,
  initiator,
}: {
  patient: Patient;
  facilityId: string;
  getOrgIdExcludeList: () => Promise<string[]>;
  requestId?: string;
  forceCWCreate?: boolean;
  rerunPdOnNewDemographics?: boolean;
  initiator?: HieInitiator;
}): Promise<{ commonwellPatientId: string; personId: string } | void> {
  const { log, debug } = out(`CW create - M patientId ${patient.id}`);

  const isCwEnabled = await validateCWEnabled({
    patient,
    facilityId,
    forceCW: forceCWCreate,
    log,
  });

  const demoAugEnabled = await isDemoAugEnabledForCx(patient.cxId);
  const cxRerunPdOnNewDemographics = demoAugEnabled || rerunPdOnNewDemographics;

  if (isCwEnabled) {
    const requestId = inputRequestId ?? uuidv7();
    const startedAt = new Date();
    const updatedPatient = await updatePatientDiscoveryStatus({
      patient,
      status: "processing",
      params: {
        requestId,
        facilityId,
        startedAt,
        rerunPdOnNewDemographics: cxRerunPdOnNewDemographics,
      },
    });

    return await registerAndLinkPatientInCW({
      patient: createAugmentedPatient(updatedPatient),
      facilityId,
      getOrgIdExcludeList,
      rerunPdOnNewDemographics: cxRerunPdOnNewDemographics,
      requestId,
      startedAt,
      debug,
      initiator,
    });
  }
}

async function registerAndLinkPatientInCW({
  patient,
  facilityId,
  getOrgIdExcludeList,
  rerunPdOnNewDemographics,
  requestId,
  startedAt,
  debug,
  initiator,
}: {
  patient: Patient;
  facilityId: string;
  getOrgIdExcludeList: () => Promise<string[]>;
  rerunPdOnNewDemographics: boolean;
  requestId: string;
  startedAt: Date;
  debug: typeof console.log;
  initiator?: HieInitiator;
}): Promise<{ commonwellPatientId: string; personId: string } | void> {
  const { log } = out(`registerAndLinkPatientInCW - patientId ${patient.id}`);
  let commonWell: CommonWellAPI | undefined;
  try {
    const { commonWellAPI, queryMeta, commonwellPatient } = await setupApiAndCwPatient({
      patient,
      facilityId,
      initiator,
    });
    commonWell = commonWellAPI;

    // Patients of cxs that not go through EC should have theis status undefined so they're not picked up later
    // when we enable it
    const cqLinkStatus = (await isEnhancedCoverageEnabledForCx(patient.cxId))
      ? "unlinked"
      : undefined;
    await updateCommonwellIdsAndStatus({ patient, cqLinkStatus });

    debug(`Registering this Patient: `, () => JSON.stringify(commonwellPatient, null, 2));
    const { commonwellPatientId, patientRefLink } = await registerPatient({
      commonWell,
      queryMeta,
      commonwellPatient,
      patient,
    });

    const { personId, networkLinks } = await findOrCreatePersonAndLink({
      commonWell,
      queryMeta,
      commonwellPatient,
      commonwellPatientId,
      patientRefLink,
      patient,
      getOrgIdExcludeList,
    });

    let cwLinks: CwLink[] = [];
    if (networkLinks) {
      cwLinks = await createCwLinks(patient, networkLinks);
    }

    if (rerunPdOnNewDemographics) {
      const startedNewPd = await runNextPdOnNewDemographics({
        patient,
        facilityId,
        getOrgIdExcludeList,
        requestId,
        cwLinks,
      });
      if (startedNewPd) return;
    }

    analytics({
      distinctId: patient.cxId,
      event: EventTypes.patientDiscovery,
      properties: {
        hie: MedicalDataSource.COMMONWELL,
        patientId: patient.id,
        requestId,
        pdLinks: cwLinks.length,
        duration: elapsedTimeFromNow(startedAt),
      },
    });

    const startedNewPd = await runNexPdIfScheduled({
      patient,
      requestId,
    });
    if (startedNewPd) return;
    await updatePatientDiscoveryStatus({ patient, status: "completed" });
    await queryDocsIfScheduled({ patientIds: patient, getOrgIdExcludeList });
    debug("Completed.");
    return { commonwellPatientId, personId };
  } catch (error) {
    // TODO 1646 Move to a single hit to the DB
    await resetScheduledPatientDiscovery({
      patient,
      source: MedicalDataSource.COMMONWELL,
    });
    await updatePatientDiscoveryStatus({ patient, status: "failed" });
    await queryDocsIfScheduled({ patientIds: patient, getOrgIdExcludeList, isFailed: true });
    const msg = `Failure while creating patient @ CW`;
    const cwRef = commonWell?.lastReferenceHeader;
    log(
      `${msg}. Patient ID: ${patient.id}. Cause: ${errorToString(error)}. CW Reference: ${cwRef}`
    );
    capture.error(msg, {
      extra: {
        facilityId,
        patientId: patient.id,
        cwReference: cwRef,
        context: createContext,
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
  requestId: inputRequestId,
  forceCWUpdate = false,
  rerunPdOnNewDemographics = false,
}: {
  patient: Patient;
  facilityId: string;
  getOrgIdExcludeList: () => Promise<string[]>;
  requestId?: string;
  forceCWUpdate?: boolean;
  rerunPdOnNewDemographics?: boolean;
}): Promise<void> {
  const { log, debug } = out(`CW update - M patientId ${patient.id}`);

  const isCwEnabled = await validateCWEnabled({
    patient,
    facilityId,
    forceCW: forceCWUpdate,
    log,
  });

  const demoAugEnabled = await isDemoAugEnabledForCx(patient.cxId);
  const cxRerunPdOnNewDemographics = demoAugEnabled || rerunPdOnNewDemographics;

  if (isCwEnabled) {
    const requestId = inputRequestId ?? uuidv7();
    const startedAt = new Date();
    const updatedPatient = await updatePatientDiscoveryStatus({
      patient,
      status: "processing",
      params: {
        requestId,
        facilityId,
        startedAt,
        rerunPdOnNewDemographics: cxRerunPdOnNewDemographics,
      },
    });

    await updatePatientAndLinksInCw({
      patient: createAugmentedPatient(updatedPatient),
      facilityId,
      getOrgIdExcludeList,
      rerunPdOnNewDemographics: cxRerunPdOnNewDemographics,
      requestId,
      startedAt,
      debug,
    });
  }
}

async function updatePatientAndLinksInCw({
  patient,
  facilityId,
  getOrgIdExcludeList,
  rerunPdOnNewDemographics,
  requestId,
  startedAt,
  debug,
}: {
  patient: Patient;
  facilityId: string;
  getOrgIdExcludeList: () => Promise<string[]>;
  rerunPdOnNewDemographics: boolean;
  requestId: string;
  startedAt: Date;
  debug: typeof console.log;
}): Promise<void> {
  const { log } = out(`updatePatientAndLinksInCw - patientId ${patient.id}`);
  let commonWell: CommonWellAPI | undefined;
  try {
    const updateData = await setupPatient({ patient });
    if (!updateData) {
      capture.message("Could not find external data on Patient, creating it @ CW", {
        extra: { patientId: patient.id, context: updateContext },
      });
      await registerAndLinkPatientInCW({
        patient,
        facilityId,
        getOrgIdExcludeList,
        rerunPdOnNewDemographics,
        requestId,
        startedAt,
        debug,
      });
      return;
    }
    const { commonwellPatientId, personId } = updateData;
    const { commonWellAPI, queryMeta, commonwellPatient } = await setupApiAndCwPatient({
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

    const networkLinks = await updatePersonAndLink({
      commonWell,
      queryMeta,
      commonwellPatient,
      commonwellPatientId,
      personId,
      patientRefLink,
      patient,
      getOrgIdExcludeList,
    });

    let cwLinks: CwLink[] = [];
    if (networkLinks) {
      cwLinks = await createCwLinks(patient, networkLinks);
    }

    if (rerunPdOnNewDemographics) {
      const startedNewPd = await runNextPdOnNewDemographics({
        patient,
        facilityId,
        getOrgIdExcludeList,
        requestId,
        cwLinks,
      });
      if (startedNewPd) return;
    }

    analytics({
      distinctId: patient.cxId,
      event: EventTypes.patientDiscovery,
      properties: {
        hie: MedicalDataSource.COMMONWELL,
        patientId: patient.id,
        requestId,
        pdLinks: cwLinks.length,
        duration: elapsedTimeFromNow(startedAt),
      },
    });

    const startedNewPd = await runNexPdIfScheduled({
      patient,
      requestId,
    });
    if (startedNewPd) return;
    await updatePatientDiscoveryStatus({ patient, status: "completed" });
    await queryDocsIfScheduled({ patientIds: patient, getOrgIdExcludeList });
    debug("Completed.");
  } catch (error) {
    // TODO 1646 Move to a single hit to the DB
    await resetScheduledPatientDiscovery({
      patient,
      source: MedicalDataSource.COMMONWELL,
    });
    await updatePatientDiscoveryStatus({ patient, status: "failed" });
    await queryDocsIfScheduled({ patientIds: patient, getOrgIdExcludeList, isFailed: true });
    const msg = `Failed to update patient @ CW`;
    const cwRef = commonWell?.lastReferenceHeader;
    log(`${msg} ${patient.id}:. Cause: ${errorToString(error)}. CW Reference: ${cwRef}`);
    capture.error(msg, {
      extra: {
        facilityId,
        patientId: patient.id,
        cwReference: cwRef,
        context: updateContext,
        error,
      },
    });
    throw error;
  }
}

async function createCwLinks(
  patient: Pick<Patient, "id" | "cxId">,
  pdResults: NetworkLink[]
): Promise<CwLink[]> {
  const { id, cxId } = patient;
  const cwLinks = pdResults;

  if (cwLinks.length > 0) await createOrUpdateCwPatientData({ id, cxId, cwLinks });

  return cwLinks;
}

export async function runNextPdOnNewDemographics({
  patient,
  facilityId,
  getOrgIdExcludeList,
  requestId,
  cwLinks,
}: {
  patient: Patient;
  facilityId: string;
  getOrgIdExcludeList: () => Promise<string[]>;
  requestId: string;
  cwLinks: CwLink[];
}): Promise<boolean> {
  const updatedPatient = await getPatientOrFail(patient);

  const linksDemographics = getPatientNetworkLinks(cwLinks).map(
    patientNetworkLinkToNormalizedLinkDemographics
  );
  const newDemographicsHere = getNewDemographics(updatedPatient, linksDemographics);
  const foundNewDemographicsHere = newDemographicsHere.length > 0;
  const foundNewDemographicsAcrossHies = await checkLinkDemographicsAcrossHies({
    patient: updatedPatient,
    requestId,
  });
  if (!foundNewDemographicsHere && !foundNewDemographicsAcrossHies) {
    return false;
  }

  if (foundNewDemographicsHere) {
    await Promise.all([
      updateCwPatientData({
        id: updatedPatient.id,
        cxId: updatedPatient.cxId,
        requestLinksDemographics: {
          requestId,
          linksDemographics: newDemographicsHere,
        },
      }),
      updatePatientLinkDemographics({
        requestId,
        patient: updatedPatient,
        source: MedicalDataSource.COMMONWELL,
        links: newDemographicsHere,
      }),
    ]);
  }
  update({
    patient: updatedPatient,
    facilityId,
    getOrgIdExcludeList,
    rerunPdOnNewDemographics: false,
  }).catch(processAsyncError("CW update"));
  analytics({
    distinctId: updatedPatient.cxId,
    event: EventTypes.rerunOnNewDemographics,
    properties: {
      hie: MedicalDataSource.COMMONWELL,
      patientId: updatedPatient.id,
      requestId,
      foundNewDemographicsHere,
      foundNewDemographicsAcrossHies,
    },
  });
  return true;
}

export async function runNexPdIfScheduled({
  patient,
  requestId,
}: {
  patient: Patient;
  requestId: string;
}): Promise<boolean> {
  const updatedPatient = await getPatientOrFail(patient);

  const scheduledPdRequest = getCWData(updatedPatient.data.externalData)?.scheduledPdRequest;
  if (!scheduledPdRequest) {
    return false;
  }

  await resetScheduledPatientDiscovery({
    patient,
    source: MedicalDataSource.COMMONWELL,
  });
  update({
    patient: updatedPatient,
    facilityId: scheduledPdRequest.facilityId,
    getOrgIdExcludeList: () =>
      new Promise(resolve => {
        resolve(scheduledPdRequest.orgIdExcludeList ?? []);
      }),
    requestId: scheduledPdRequest.requestId,
    forceCWUpdate: scheduledPdRequest.forceCommonwell,
    rerunPdOnNewDemographics: scheduledPdRequest.rerunPdOnNewDemographics,
  }).catch(processAsyncError("CW update"));
  analytics({
    distinctId: updatedPatient.cxId,
    event: EventTypes.runScheduledPatientDiscovery,
    properties: {
      hie: MedicalDataSource.COMMONWELL,
      patientId: updatedPatient.id,
      requestId,
      scheduledPdRequestId: scheduledPdRequest.requestId,
    },
  });
  return true;
}

export async function queryDocsIfScheduled({
  patientIds,
  getOrgIdExcludeList,
  isFailed = false,
}: {
  patientIds: Pick<Patient, "id" | "cxId">;
  getOrgIdExcludeList: () => Promise<string[]>;
  isFailed?: boolean;
}): Promise<void> {
  const patient = await getPatientOrFail(patientIds);

  const cwData = getCWData(patient.data.externalData);
  const scheduledDocQueryRequestId = cwData?.scheduledDocQueryRequestId;
  const scheduledDocQueryRequestTriggerConsolidated =
    cwData?.scheduledDocQueryRequestTriggerConsolidated;
  if (!scheduledDocQueryRequestId) {
    return;
  }

  await resetPatientScheduledDocQueryRequestId({
    patient,
    source: MedicalDataSource.COMMONWELL,
  });
  if (isFailed) {
    await setDocQueryProgress({
      patient,
      requestId: scheduledDocQueryRequestId,
      source: MedicalDataSource.COMMONWELL,
      downloadProgress: { status: "failed", total: 0 },
      convertProgress: { status: "failed", total: 0 },
    });
  } else {
    queryAndProcessDocuments({
      patient,
      requestId: scheduledDocQueryRequestId,
      triggerConsolidated: scheduledDocQueryRequestTriggerConsolidated,
      getOrgIdExcludeList,
    }).catch(processAsyncError("CW queryAndProcessDocuments"));
  }
}

export async function get(
  patient: Patient,
  facilityId: string
): Promise<CommonwellPatient | undefined> {
  const { log, debug } = out(`CW get - M patientId ${patient.id}`);
  let commonWell: CommonWellAPI | undefined;
  try {
    const isCwEnabled = await validateCWEnabled({
      patient,
      facilityId,
      log,
    });
    if (!isCwEnabled) return undefined;

    const getData = await setupPatient({ patient });
    if (!getData) return undefined;

    const { commonwellPatientId } = getData;
    const { commonWellAPI, queryMeta } = await setupApiAndCwPatient({ patient, facilityId });
    commonWell = commonWellAPI;

    const respPatient = await commonWell.getPatient(queryMeta, commonwellPatientId);
    debug(`resp getPatient: `, JSON.stringify(respPatient));

    return respPatient;
  } catch (error) {
    const msg = `Failed to get patient @ CW`;
    const cwRef = commonWell?.lastReferenceHeader;
    log(
      `${msg}. Patient ID: ${patient.id}. Cause: ${errorToString(error)}. CW Reference: ${cwRef}`
    );
    capture.error(msg, {
      extra: {
        facilityId,
        patientId: patient.id,
        cwReference: cwRef,
        context: getContext,
      },
    });
    throw error;
  }
}

export async function remove(patient: Patient, facilityId: string): Promise<void> {
  const { log } = out(`CW delete - M patientId ${patient.id}`);
  let commonWell: CommonWellAPI | undefined;
  try {
    const isCwEnabled = await validateCWEnabled({
      patient,
      facilityId,
      log,
    });
    if (!isCwEnabled) return;

    const removeData = await setupPatient({ patient });
    if (!removeData) return;

    const { commonwellPatientId } = removeData;
    const { commonWellAPI, queryMeta } = await setupApiAndCwPatient({ patient, facilityId });
    commonWell = commonWellAPI;

    await Promise.all([
      commonWell.deletePatient(queryMeta, commonwellPatientId),
      deleteCwPatientData({ id: patient.id, cxId: patient.cxId }),
    ]);
  } catch (error) {
    const msg = `Failed to delete patient @ CW`;
    const cwRef = commonWell?.lastReferenceHeader;
    log(
      `${msg}. Patient ID: ${patient.id}. Cause: ${errorToString(error)}. CW Reference: ${cwRef}`
    );
    capture.error(msg, {
      extra: {
        facilityId,
        patientId: patient.id,
        cwReference: cwRef,
        context: deleteContext,
        error,
      },
    });
    throw error;
  }
}

async function setupPatient({
  patient,
}: {
  patient: Patient;
}): Promise<{ commonwellPatientId: string; personId: string } | undefined> {
  const commonwellData = getCWData(patient.data.externalData);
  if (!commonwellData) return undefined;
  const commonwellPatientId = commonwellData.patientId;
  const personId = commonwellData.personId;
  if (!commonwellPatientId || !personId) return undefined;

  return { commonwellPatientId, personId };
}

async function setupApiAndCwPatient({
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
  getOrgIdExcludeList,
}: {
  commonWell: CommonWellAPI;
  queryMeta: RequestMetadata;
  commonwellPatient: CommonwellPatient;
  commonwellPatientId: string;
  patientRefLink: string;
  patient: Patient;
  getOrgIdExcludeList: () => Promise<string[]>;
}): Promise<{ personId: string; networkLinks: NetworkLink[] | undefined }> {
  const { log, debug } = out(`CW findOrCreatePersonAndLink - CW patientId ${commonwellPatientId}`);
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
    throw err;
  }
  if (!findOrCreateResponse) throw new MetriportError("Programming error: unexpected state");
  const { personId, person } = findOrCreateResponse;

  await updateCommonwellIdsAndStatus({ patient, commonwellPersonId: personId });

  // Link Person to Patient
  try {
    const strongIds = getMatchingStrongIds(person, commonwellPatient);
    const respLink = await commonWell.addPatientLink(
      queryMeta,
      personId,
      patientRefLink,
      // safe to get the first one, just need to match one of the person's strong IDs
      strongIds.length > 0 ? strongIds[0] : undefined
    );
    debug(`resp addPatientLink: `, JSON.stringify(respLink));
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

async function updatePersonAndLink({
  commonWell,
  queryMeta,
  commonwellPatient,
  commonwellPatientId,
  personId,
  patientRefLink,
  patient,
  getOrgIdExcludeList,
}: {
  commonWell: CommonWellAPI;
  queryMeta: RequestMetadata;
  commonwellPatient: CommonwellPatient;
  commonwellPatientId: string;
  personId: string;
  patientRefLink: string;
  patient: Patient;
  getOrgIdExcludeList: () => Promise<string[]>;
}): Promise<NetworkLink[] | undefined> {
  const { log, debug } = out(`CW updatePersonAndLink - CW patientId ${commonwellPatientId}`);
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
      const cwRef = commonWell.lastReferenceHeader;
      log(`${subject} - CW Person ID ${personId}. CW Reference: ${cwRef}`);
      capture.message(subject, {
        extra: {
          commonwellPatientId,
          personId,
          cwReference: cwRef,
          context: updateContext,
        },
      });
      const { networkLinks } = await findOrCreatePersonAndLink({
        commonWell,
        queryMeta,
        commonwellPatient,
        commonwellPatientId,
        patientRefLink,
        patient,
        getOrgIdExcludeList,
      });
      return networkLinks;
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
    const strongIds = getMatchingStrongIds(person, commonwellPatient);
    const { hasLink, isLinkLola3Plus } = await getLinkInfo({
      commonWell,
      queryMeta,
      personId,
      commonwellPatientId,
    });
    if (!hasLink || (!isLinkLola3Plus && strongIds.length > 0)) {
      const respLink = await commonWell.addPatientLink(
        queryMeta,
        personId,
        patientRefLink,
        // safe to get the first one, just need to match one of the person's strong IDs
        strongIds[0]
      );
      debug(`resp addPatientLink: `, JSON.stringify(respLink));
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

  return networkLinks;
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
  const { log } = out(`${fnName} - CW patientId ${commonwellPatientId}`);
  if (!commonwellPatientId) {
    const msg = `Could not determine the patient ID from CW`;
    log(
      `ERR - ${msg} - Patient created @ CW but not the Person - ` +
        `Patient @ Commonwell: ${JSON.stringify(respPatient)}`
    );
    throw new Error(msg);
  }

  await updateCommonwellIdsAndStatus({ patient, commonwellPatientId });

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
  commonWell: CommonWellAPI;
  queryMeta: RequestMetadata;
  commonwellPatient: CommonwellPatient;
  commonwellPatientId: string;
}): Promise<{ patientRefLink: string }> {
  const { log, debug } = out(`CW updatePatient - CW patientId ${commonwellPatientId}`);

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
  personId,
  commonwellPatientId,
}: {
  commonWell: CommonWellAPI;
  queryMeta: RequestMetadata;
  personId: string;
  commonwellPatientId: string;
}): Promise<{ hasLink: boolean; isLinkLola3Plus: boolean }> {
  const { debug } = out(`CW getLinkInfo - CW patientId ${commonwellPatientId}`);

  const respLinks = await commonWell.getPatientLinks(queryMeta, personId);
  debug(`resp getPatientLinks: `, JSON.stringify(respLinks));

  const linkToPatient = respLinks._embedded.patientLink.find(l =>
    l.patient ? l.patient.includes(commonwellPatientId) : false
  );
  const hasLink = Boolean(linkToPatient && linkToPatient.assuranceLevel);
  const isLinkLola3Plus = linkToPatient?.assuranceLevel
    ? [LOLA.level_3, LOLA.level_4]
        .map(level => level.toString())
        .includes(linkToPatient.assuranceLevel)
    : false;
  return { hasLink, isLinkLola3Plus };
}
