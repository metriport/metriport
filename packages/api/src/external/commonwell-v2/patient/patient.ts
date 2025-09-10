import {
  CommonWellAPI,
  Patient as CommonwellPatient,
  CwLinkV2,
  getCwPatientIdFromLinks,
  PatientExistingLink,
  PatientExistingLinks,
  PatientIdentifier,
  PatientProbableLink,
  PatientProbableLinks,
  StatusResponse,
} from "@metriport/commonwell-sdk";
import { decodeCwPatientIdV1, encodeCwPatientId } from "@metriport/commonwell-sdk/common/util";
import {
  DriversLicense,
  Patient,
  PatientData,
  PatientExternalData,
} from "@metriport/core/domain/patient";
import { LinkDemographics } from "@metriport/core/domain/patient-demographics";
import { analytics, EventTypes } from "@metriport/core/external/analytics/posthog";
import { fhirIdentifierToDriversLicense } from "@metriport/core/external/fhir/patient/conversion";
import { MedicalDataSource } from "@metriport/core/external/index";
import { processAsyncError } from "@metriport/core/util/error/shared";
import { out } from "@metriport/core/util/log";
import { capture } from "@metriport/core/util/notifications";
import { errorToString, MetriportError, sleep, USStateForAddress } from "@metriport/shared";
import { buildDayjs, elapsedTimeFromNow, ISO_DATE } from "@metriport/shared/common/date";
import dayjs from "dayjs";
import duration from "dayjs/plugin/duration";
import httpStatus from "http-status";
import { partition } from "lodash";
import { createOrUpdateInvalidLinks } from "../../../command/medical/invalid-links/create-invalid-links";
import { getPatientOrFail } from "../../../command/medical/patient/get-patient";
import { getNewDemographics } from "../../../domain/medical/patient-demographics";
import { UpdatePatientCmd } from "../../commonwell/patient/command-types";
import { createOrUpdateCwPatientData } from "../../commonwell/patient/cw-patient-data/create-cw-data";
import { deleteCwPatientData } from "../../commonwell/patient/cw-patient-data/delete-cw-data";
import { updateCwPatientData } from "../../commonwell/patient/cw-patient-data/update-cw-data";
import {
  updateCommonwellIdsAndStatus,
  updatePatientDiscoveryStatus,
} from "../../commonwell/patient/patient-external-data";
import {
  cwGenderToPatientGender,
  PatientDataCommonwell,
} from "../../commonwell/patient/patient-shared";
import { getCwInitiator } from "../../commonwell/shared";
import { checkLinkDemographicsAcrossHies } from "../../hie/check-patient-link-demographics";
import { HieInitiator } from "../../hie/get-hie-initiator";
import { resetPatientScheduledDocQueryRequestId } from "../../hie/reset-scheduled-doc-query-request-id";
import { resetScheduledPatientDiscovery } from "../../hie/reset-scheduled-patient-discovery-request";
import { setDocQueryProgress } from "../../hie/set-doc-query-progress";
import { updatePatientLinkDemographics } from "../../hie/update-patient-link-demographics";
import { validateCwLinksBelongToPatient } from "../../hie/validate-patient-links";
import { makeCommonWellAPI } from "../api";
import { queryAndProcessDocuments } from "../document/document-query";
import { patientToCommonwell } from "./patient-conversion";
import { networkLinkToLinkDemographics } from "./patient-demographics";
import { NetworkLink } from "./types";

dayjs.extend(duration);

const waitTimeAfterRegisterPatientAndBeforeGetLinks = dayjs.duration(5, "seconds");
const MAX_ATTEMPTS_PATIENT_LINKING = 3;

const createContext = "cw.patient.create";
const updateContext = "cw.patient.update";
const deleteContext = "cw.patient.delete";

function getCWData(data: PatientExternalData | undefined): PatientDataCommonwell | undefined {
  if (!data) return undefined;
  return data[MedicalDataSource.COMMONWELL] as PatientDataCommonwell;
}

export async function registerAndLinkPatientInCwV2({
  patient,
  facilityId,
  getOrgIdExcludeList,
  rerunPdOnNewDemographics,
  requestId,
  startedAt,
  debug,
  initiator,
  update,
  shouldUpdateDb = true,
}: {
  patient: Patient;
  facilityId: string;
  getOrgIdExcludeList: () => Promise<string[]>;
  rerunPdOnNewDemographics: boolean;
  requestId: string;
  startedAt: Date;
  debug: typeof console.log;
  initiator?: HieInitiator;
  update: (params: UpdatePatientCmd) => Promise<void>;
  shouldUpdateDb?: boolean;
}): Promise<{ commonwellPatientId: string } | void> {
  const { log } = out(`registerAndLinkPatientInCW.v2 - patientId ${patient.id}`);
  let commonWell: CommonWellAPI | undefined;
  try {
    const { commonWellAPI, commonwellPatient } = await setupApiAndCwPatient({
      patient,
      facilityId,
      initiator,
    });
    commonWell = commonWellAPI;

    if (shouldUpdateDb) {
      await updateCommonwellIdsAndStatus({ patient, cqLinkStatus: undefined });
    }

    debug(`Registering this Patient: `, () => JSON.stringify(commonwellPatient, null, 2));

    const { commonwellPatientId } = await registerPatient({
      commonWell,
      commonwellPatient,
      patient,
      shouldUpdateDb,
    });

    const { validLinks, invalidLinks } = await runPatientLinkingWithRetries({
      commonWell,
      patient,
      commonwellPatientId,
      context: createContext,
      getOrgIdExcludeList,
      shouldUpdateDb,
    });

    if (rerunPdOnNewDemographics) {
      const startedNewPd = await runNextPdOnNewDemographics({
        patient,
        facilityId,
        getOrgIdExcludeList,
        requestId,
        cwLinks: validLinks,
        update,
        shouldUpdateDb,
      });
      if (startedNewPd) return;
    }

    if (shouldUpdateDb) {
      analytics({
        distinctId: patient.cxId,
        event: EventTypes.patientDiscovery,
        properties: {
          hie: MedicalDataSource.COMMONWELL,
          patientId: patient.id,
          requestId,
          pdLinks: validLinks.length,
          pdLinksInvalid: invalidLinks.length,
          duration: elapsedTimeFromNow(startedAt),
        },
      });
      const startedNewPd = await runNextPdIfScheduled({
        patient,
        requestId,
        update,
      });
      if (startedNewPd) return;

      await updatePatientDiscoveryStatus({ patient, status: "completed" });
      await queryDocsIfScheduled({ patientIds: patient, getOrgIdExcludeList });
    }
    debug("Completed.");
    return { commonwellPatientId };
  } catch (error) {
    // TODO 1646 Move to a single hit to the DB
    if (shouldUpdateDb) {
      await resetScheduledPatientDiscovery({
        patient,
        source: MedicalDataSource.COMMONWELL,
      });
      await updatePatientDiscoveryStatus({ patient, status: "failed" });
      await queryDocsIfScheduled({ patientIds: patient, getOrgIdExcludeList, isFailed: true });
    }
    const msg = `Failure while creating patient @ CW`;
    const cwRef = commonWell?.lastTransactionId;
    log(
      `${msg}. Patient ID: ${patient.id}. Cause: ${errorToString(error)}. CW Reference: ${cwRef}`
    );
    capture.error(msg, {
      extra: {
        cxId: patient.cxId,
        facilityId,
        patientId: patient.id,
        cwReference: cwRef,
        context: createContext,
        error: errorToString(error),
      },
    });
    throw error;
  }
}

async function getExistingLinks({
  commonWell,
  commonwellPatientId,
}: {
  commonWell: CommonWellAPI;
  commonwellPatientId: string;
}): Promise<PatientExistingLinks> {
  const links = await commonWell.getPatientLinksByPatientId(commonwellPatientId);
  return links;
}

async function getProbableLinks({
  commonWell,
  commonwellPatientId,
}: {
  commonWell: CommonWellAPI;
  commonwellPatientId: string;
}): Promise<PatientProbableLinks> {
  const probableLinks = await commonWell.getProbableLinksById(commonwellPatientId);
  return probableLinks;
}

export async function updatePatientAndLinksInCwV2({
  patient,
  facilityId,
  getOrgIdExcludeList,
  rerunPdOnNewDemographics,
  requestId,
  startedAt,
  debug,
  update,
  shouldUpdateDb = true,
}: {
  patient: Patient;
  facilityId: string;
  getOrgIdExcludeList: () => Promise<string[]>;
  rerunPdOnNewDemographics: boolean;
  requestId: string;
  startedAt: Date;
  debug: typeof console.log;
  update: (params: UpdatePatientCmd) => Promise<void>;
  shouldUpdateDb?: boolean;
}): Promise<void> {
  const { log } = out(`updatePatientAndLinksInCw.v2 - patientId ${patient.id}`);
  let commonWell: CommonWellAPI | undefined;

  try {
    const commonwellPatientId = await getCommonwellPatientId(patient);
    if (!commonwellPatientId) {
      log(`Could not find external data on Patient, creating it @ CW`);
      await registerAndLinkPatientInCwV2({
        patient,
        facilityId,
        getOrgIdExcludeList,
        rerunPdOnNewDemographics,
        requestId,
        startedAt,
        debug,
        update,
        shouldUpdateDb,
      });
      return;
    }

    const { commonWellAPI, commonwellPatient } = await setupApiAndCwPatient({
      patient,
      facilityId,
    });
    commonWell = commonWellAPI;

    debug(`Updating this Patient: `, () => JSON.stringify(commonwellPatient, null, 2));
    await updatePatient({
      commonWell,
      commonwellPatient,
      commonwellPatientId,
    });

    const { validLinks, invalidLinks } = await runPatientLinkingWithRetries({
      commonWell,
      patient,
      commonwellPatientId,
      context: updateContext,
      getOrgIdExcludeList,
      shouldUpdateDb,
    });

    if (rerunPdOnNewDemographics) {
      const startedNewPd = await runNextPdOnNewDemographics({
        patient,
        facilityId,
        getOrgIdExcludeList,
        requestId,
        cwLinks: validLinks,
        update,
        shouldUpdateDb,
      });
      if (startedNewPd) return;
    }

    if (shouldUpdateDb) {
      analytics({
        distinctId: patient.cxId,
        event: EventTypes.patientDiscovery,
        properties: {
          hie: MedicalDataSource.COMMONWELL,
          patientId: patient.id,
          requestId,
          pdLinks: validLinks.length,
          pdLinksInvalid: invalidLinks.length,
          duration: elapsedTimeFromNow(startedAt),
        },
      });

      const startedNewPd = await runNextPdIfScheduled({
        patient,
        requestId,
        update,
      });

      if (startedNewPd) return;

      await updatePatientDiscoveryStatus({ patient, status: "completed" });
      await queryDocsIfScheduled({ patientIds: patient, getOrgIdExcludeList });
    }
    debug("Completed.");
  } catch (error) {
    if (shouldUpdateDb) {
      // TODO 1646 Move to a single hit to the DB
      await resetScheduledPatientDiscovery({
        patient,
        source: MedicalDataSource.COMMONWELL,
      });
      await updatePatientDiscoveryStatus({ patient, status: "failed" });
      await queryDocsIfScheduled({ patientIds: patient, getOrgIdExcludeList, isFailed: true });
    }
    const msg = `Failed to update patient @ CW`;
    const cwRef = commonWell?.lastTransactionId;
    log(`${msg} ${patient.id}:. Cause: ${errorToString(error)}. CW Reference: ${cwRef}`);
    capture.error(msg, {
      extra: {
        cxId: patient.cxId,
        facilityId,
        patientId: patient.id,
        cwReference: cwRef,
        context: updateContext,
        error: errorToString(error),
      },
    });
    throw error;
  }
}

async function runNextPdOnNewDemographics({
  patient,
  facilityId,
  getOrgIdExcludeList,
  requestId,
  cwLinks,
  update,
  shouldUpdateDb,
}: {
  patient: Patient;
  facilityId: string;
  getOrgIdExcludeList: () => Promise<string[]>;
  requestId: string;
  cwLinks: NetworkLink[];
  update: (params: UpdatePatientCmd) => Promise<void>;
  shouldUpdateDb: boolean;
}): Promise<boolean> {
  const updatedPatient = await getPatientOrFail(patient);

  const linksDemographics: LinkDemographics[] = cwLinks.map(networkLinkToLinkDemographics);
  const newDemographicsHere = getNewDemographics(updatedPatient, linksDemographics);
  const foundNewDemographicsHere = newDemographicsHere.length > 0;
  const foundNewDemographicsAcrossHies = await checkLinkDemographicsAcrossHies({
    patient: updatedPatient,
    requestId,
  });
  if (!foundNewDemographicsHere && !foundNewDemographicsAcrossHies) {
    return false;
  }

  if (foundNewDemographicsHere && shouldUpdateDb) {
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
  if (shouldUpdateDb) {
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
  }
  return true;
}

async function runNextPdIfScheduled({
  patient,
  requestId,
  update,
}: {
  patient: Patient;
  requestId: string;
  update: (params: UpdatePatientCmd) => Promise<void>;
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

async function queryDocsIfScheduled({
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

export async function removeInCwV2(patient: Patient, facilityId: string): Promise<void> {
  const { log } = out(`CW.v2 delete - M patientId ${patient.id}`);
  let commonWell: CommonWellAPI | undefined;
  try {
    const commonwellPatientId = await getCommonwellPatientId(patient);
    if (!commonwellPatientId) return;

    const { commonWellAPI } = await setupApiAndCwPatient({ patient, facilityId });
    commonWell = commonWellAPI;

    await Promise.all([
      commonWell.deletePatient(commonwellPatientId),
      deleteCwPatientData({ id: patient.id, cxId: patient.cxId }),
    ]);
  } catch (error) {
    const msg = `Failed to delete patient @ CW`;
    const cwRef = commonWell?.lastTransactionId;
    log(
      `${msg}. Patient ID: ${patient.id}. Cause: ${errorToString(error)}. CW Reference: ${cwRef}`
    );
    capture.error(msg, {
      extra: {
        cxId: patient.cxId,
        facilityId,
        patientId: patient.id,
        cwReference: cwRef,
        context: deleteContext,
        error: errorToString(error),
      },
    });
    throw error;
  }
}

async function getCommonwellPatientId(patient: Patient): Promise<string | undefined> {
  const commonwellData = getCWData(patient.data.externalData);
  if (!commonwellData) return undefined;
  return getCwV2PatientId(commonwellData.patientId);
}

function getCwV2PatientId(patientId: string): string {
  if (!patientId.includes("urn")) return patientId;

  const decoded = decodeCwPatientIdV1(patientId);
  if (!decoded.value || !decoded.assignAuthority) throw new MetriportError("Invalid patient ID");
  return encodeCwPatientId({
    patientId: decoded.value,
    assignAuthority: decoded.assignAuthority.replace("urn:oid:", ""),
  });
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
  commonwellPatient: CommonwellPatient;
}> {
  const _initiator = initiator ?? (await getCwInitiator(patient, facilityId));
  const initiatorName = _initiator.name;
  const initiatorOid = _initiator.oid;
  const initiatorNpi = _initiator.npi;

  const commonwellPatient = patientToCommonwell({
    patient,
    orgName: initiatorName,
    orgOID: initiatorOid,
  });

  const commonWellAPI = makeCommonWellAPI(initiatorName, initiatorOid, initiatorNpi);
  return { commonWellAPI, commonwellPatient };
}

async function registerPatient({
  commonWell,
  commonwellPatient,
  patient,
  shouldUpdateDb,
}: {
  commonWell: CommonWellAPI;
  commonwellPatient: CommonwellPatient;
  patient: Patient;
  shouldUpdateDb: boolean;
}): Promise<{ commonwellPatientId: string }> {
  const fnName = `CW.v2 registerPatient`;
  const { log, debug } = out(fnName);

  const respPatient = await commonWell.createOrUpdatePatient(commonwellPatient);
  debug(`resp registerPatient: `, () => JSON.stringify(respPatient));
  log(`respPatient: `, JSON.stringify(respPatient));
  const commonwellPatientId = getCwPatientIdFromLinks(respPatient.Links);
  if (!commonwellPatientId) {
    const msg = `Could not determine the patient ID from CW`;
    log(
      `ERR - ${msg} - Patient created @ CW but not the Person - ` +
        `Patient @ Commonwell: ${JSON.stringify(respPatient)}`
    );
    throw new Error(msg);
  }

  if (shouldUpdateDb) {
    await updateCommonwellIdsAndStatus({ patient, commonwellPatientId });
  }

  return { commonwellPatientId };
}

async function updatePatient({
  commonWell,
  commonwellPatient,
  commonwellPatientId,
}: {
  commonWell: CommonWellAPI;
  commonwellPatient: CommonwellPatient;
  commonwellPatientId: string;
}): Promise<string> {
  const { debug } = out(`CW.v2 updatePatient - CW patientId ${commonwellPatientId}`);

  const respUpdate = await commonWell.createOrUpdatePatient(commonwellPatient);
  debug(`resp updatePatient: `, JSON.stringify(respUpdate));

  const updatedId = getCwPatientIdFromLinks(respUpdate.Links);
  if (!updatedId) {
    throw new MetriportError("Could not determine the patient ID from CW after update");
  }
  return updatedId;
}

/**
 * Runs the patient linking flow with retries.
 *
 * As we upgrade links, the search fans out to find more potential links.
 */
async function runPatientLinkingWithRetries({
  commonWell,
  patient,
  commonwellPatientId,
  context,
  getOrgIdExcludeList,
  shouldUpdateDb,
}: {
  commonWell: CommonWellAPI;
  patient: Patient;
  commonwellPatientId: string;
  context: string;
  getOrgIdExcludeList: () => Promise<string[]>;
  shouldUpdateDb: boolean;
}): Promise<{
  validLinks: NetworkLink[];
  invalidLinks: NetworkLink[];
}> {
  const { log } = out(`retryPatientLinkingFlow: pt: ${patient.id}`);
  let validLinks: NetworkLink[] = [];
  let invalidLinks: NetworkLink[] = [];
  let attempt = 0;

  while (attempt < MAX_ATTEMPTS_PATIENT_LINKING) {
    // CW v2 does not return links immediately after registering a patient yet, so we need to wait.
    const waitTime = waitTimeAfterRegisterPatientAndBeforeGetLinks.asMilliseconds();
    log(`Attempt ${attempt}/${MAX_ATTEMPTS_PATIENT_LINKING} - waiting ${waitTime}ms...`);
    await sleep(waitTime);
    attempt++;

    const existingLinks = await getExistingLinks({
      commonWell,
      commonwellPatientId,
    });
    const existingLinksCount = existingLinks?.Patients?.length ?? 0;

    const probableLinks = await getProbableLinks({
      commonWell,
      commonwellPatientId,
    });
    const probableLinksCount = probableLinks?.Patients?.length ?? 0;

    log(
      `Found ${existingLinksCount} existing links, and ${probableLinksCount} probable links on attempt ${attempt}`
    );

    const result = await tryToImproveLinks({
      commonWell,
      patient,
      commonwellPatientId,
      existingLinks,
      probableLinks,
      context,
      getOrgIdExcludeList,
      shouldUpdateDb,
    });

    validLinks = result.validLinks;
    invalidLinks = result.invalidLinks;

    if (probableLinksCount < 1) {
      log(`No probable links found, stopping retry loop after attempt ${attempt}`);
      break;
    }
  }

  if (attempt >= MAX_ATTEMPTS_PATIENT_LINKING) {
    log(`Reached maximum retry attempts (${MAX_ATTEMPTS_PATIENT_LINKING}), stopping retry loop`);
  }

  return { validLinks, invalidLinks };
}

async function tryToImproveLinks({
  commonWell,
  commonwellPatientId,
  existingLinks: existingLinksParam,
  probableLinks: probableLinksParam,
  context,
  patient,
  getOrgIdExcludeList,
  shouldUpdateDb,
}: {
  commonWell: CommonWellAPI;
  commonwellPatientId: string;
  existingLinks: PatientExistingLinks;
  probableLinks: PatientProbableLinks;
  context: string;
  patient: Patient;
  getOrgIdExcludeList: () => Promise<string[]>;
  shouldUpdateDb: boolean;
}): Promise<{
  validLinks: NetworkLink[];
  invalidLinks: NetworkLink[];
}> {
  const existingLinks: PatientExistingLink[] = existingLinksParam?.Patients ?? [];
  const probableLinks: PatientProbableLink[] = probableLinksParam?.Patients ?? [];

  const networkLinks = [
    ...existingLinks.map(l => ({ ...l, type: "existing" as const })),
    ...probableLinks.map(l => ({ ...l, type: "probable" as const })),
  ];

  let validLinks: NetworkLink[] = [];
  let invalidLinks: NetworkLink[] = [];
  if (networkLinks && networkLinks.length > 0) {
    const resp = await validateAndStoreCwLinks(
      patient,
      networkLinks,
      getOrgIdExcludeList,
      shouldUpdateDb
    );
    validLinks = resp.validLinks;
    invalidLinks = resp.invalidLinks;
  }

  await autoUpgradeProbableLinks({
    commonWell,
    validLinks,
    invalidLinks,
    commonwellPatientId,
    executionContext: context,
    getOrgIdExcludeList,
  });

  return { validLinks, invalidLinks: invalidLinks };
}

async function autoUpgradeProbableLinks({
  commonWell,
  validLinks,
  invalidLinks,
  commonwellPatientId,
  executionContext,
  getOrgIdExcludeList,
}: {
  commonWell: CommonWellAPI;
  validLinks: NetworkLink[];
  invalidLinks: NetworkLink[];
  commonwellPatientId: string;
  executionContext: string;
  getOrgIdExcludeList: () => Promise<string[]>;
}): Promise<void> {
  const { log, debug } = out("CW.v2 autoUpgradeProbableLinks");

  const orgIdExcludeList = await getOrgIdExcludeList();
  debug(`validLinks: `, () => JSON.stringify(validLinks));
  debug(`invalidLinks: `, () => JSON.stringify(invalidLinks));

  const validProbableLinks = validLinks.filter(l => l.type === "probable");
  const validExistingLinks = validLinks.filter(l => l.type === "existing");
  const invalidExistingLinks = invalidLinks.filter(l => l.type === "existing");

  const validExistingToDowngrade = validExistingLinks.filter(link =>
    isInsideOrgExcludeList(link, orgIdExcludeList)
  );
  const existingToDowngrade = [...validExistingToDowngrade, ...invalidExistingLinks];
  const downgradeRequests: Promise<StatusResponse>[] = [];
  const failedDowngradeRequests: {
    url?: string;
    link?: string;
    msg: string;
    txId?: string | undefined;
  }[] = [];
  existingToDowngrade.forEach(async link => {
    const downgradeUrl = link.Links.Unlink;
    if (downgradeUrl) {
      downgradeRequests.push(
        commonWell.unlinkPatients(downgradeUrl).catch(error => {
          failedDowngradeRequests.push({
            msg: "Failed to downgrade link",
            url: downgradeUrl,
            txId: commonWell.lastTransactionId,
          });
          throw error;
        })
      );
    } else {
      failedDowngradeRequests.push({
        msg: "Missing downgrade link for existing link",
        link: JSON.stringify(link),
      });
    }
  });
  await Promise.allSettled(downgradeRequests);
  if (failedDowngradeRequests.length > 0) {
    const msg = "Failed to downgrade links";
    log(`${msg}: `, JSON.stringify(failedDowngradeRequests));
    capture.error(msg, {
      extra: {
        commonwellPatientId,
        cwReference: commonWell.lastTransactionId,
        context: executionContext,
      },
    });
  }
  const totalDowngraded = existingToDowngrade.length - failedDowngradeRequests.length;
  log(`Downgraded ${totalDowngraded} links (out of ${existingToDowngrade.length})`);

  const probableToUpgrade = validProbableLinks.filter(
    link => !isInsideOrgExcludeList(link, orgIdExcludeList)
  );
  const failedUpgradeRequests: {
    url?: string;
    link?: string;
    msg: string;
    txId?: string | undefined;
    status?: number;
  }[] = [];
  const upgradeRequests: Promise<StatusResponse>[] = [];
  probableToUpgrade.forEach(async link => {
    const upgradeUrl = link.type === "probable" ? link.Links.Link : undefined;
    if (upgradeUrl) {
      upgradeRequests.push(
        commonWell.linkPatients(upgradeUrl).catch(error => {
          if (error.response?.status === httpStatus.CONFLICT) {
            return {
              status: { code: httpStatus.CONFLICT, message: "Link already exists - not an error" },
            };
          }
          failedUpgradeRequests.push({
            msg: "Failed to upgrade link",
            url: upgradeUrl,
            txId: commonWell.lastTransactionId,
            status: error.response?.status,
          });
          throw error;
        })
      );
    } else {
      failedUpgradeRequests.push({
        msg: "Missing upgrade link for probable link",
        link: JSON.stringify(link),
      });
    }
  });
  await Promise.allSettled(upgradeRequests);
  if (failedUpgradeRequests.length > 0) {
    const msg = "Failed to upgrade links";
    log(`${msg}: `, JSON.stringify(failedUpgradeRequests));
    capture.error(msg, {
      extra: {
        commonwellPatientId,
        cwReference: commonWell.lastTransactionId,
        context: executionContext,
      },
    });
  }
  const totalUpgraded = probableToUpgrade.length - failedUpgradeRequests.length;
  log(`Upgraded ${totalUpgraded} links (out of ${probableToUpgrade.length})`);
}

function isInsideOrgExcludeList(link: NetworkLink, orgIdExcludeList: string[]): boolean {
  const urnOidRegex = /^urn:oid:/;
  const identifiers = link.Patient?.identifier || [];
  return identifiers.some(id => {
    const idSystem = id.system?.replace(urnOidRegex, "");
    if (idSystem && orgIdExcludeList.includes(idSystem)) {
      return true;
    }
    return false;
  });
}

async function validateAndStoreCwLinks(
  patient: Patient,
  networkLinks: NetworkLink[],
  getOrgIdExcludeList: () => Promise<string[]>,
  shouldUpdateDb: boolean
): Promise<{
  validLinks: NetworkLink[];
  invalidLinks: NetworkLink[];
}> {
  const { id, cxId } = patient;

  const { validNetworkLinks: validLinks, invalidLinks } = await validateCwLinksBelongToPatient(
    cxId,
    networkLinks,
    patient.data,
    probableLinkToPatientData
  );

  const orgIdExcludeList = await getOrgIdExcludeList();
  const [validLinksToDowngrade, validLinksToUpgrade] = partition(validLinks, (link: NetworkLink) =>
    isInsideOrgExcludeList(link, orgIdExcludeList)
  );

  const finalValidLinks = validLinksToUpgrade;
  const finalInvalidLinks = [...validLinksToDowngrade, ...invalidLinks];

  const validLinksV2: CwLinkV2[] = finalValidLinks.map(patientCollectionItemToCwLinkV2);
  if (validLinksV2.length > 0 && shouldUpdateDb) {
    await createOrUpdateCwPatientData({ id, cxId, cwLinks: validLinksV2 });
  }

  const invalidLinksV2: CwLinkV2[] = finalInvalidLinks.map(patientCollectionItemToCwLinkV2);
  if (invalidLinksV2.length > 0 && shouldUpdateDb) {
    await createOrUpdateInvalidLinks({
      id,
      cxId,
      invalidLinks: { commonwell: invalidLinksV2 },
    });
  }

  return { validLinks: finalValidLinks, invalidLinks: finalInvalidLinks };
}

function probableLinkToPatientData(networkLink: NetworkLink): PatientData {
  const patient = networkLink.Patient;
  if (!patient) throw new MetriportError("Patient data is missing");

  const firstName = patient.name.flatMap(name => name.given).join(" ") ?? "";
  const lastName = patient.name.flatMap(name => name.family).join(" ") ?? "";
  const dob = patient.birthDate ? buildDayjs(patient.birthDate).format(ISO_DATE) : "";

  const genderCode = patient.gender;
  const genderAtBirth = cwGenderToPatientGender(genderCode ?? undefined);

  const address = patient.address.map(addr => ({
    zip: addr.postalCode,
    city: addr.city ?? "",
    state: addr.state as USStateForAddress,
    country: addr.country ?? "USA",
    addressLine1: addr.line?.[0] ?? "",
    addressLine2: addr.line?.[1] ?? "",
  }));
  const phone = patient.telecom?.find(telecom => telecom.system === "phone")?.value ?? "";
  const email = patient.telecom?.find(telecom => telecom.system === "email")?.value ?? "";

  const personalIdentifiers = patient.identifier.flatMap(id => {
    if (id.type === "SS") {
      return {
        type: "ssn" as const,
        value: id.value,
        ...(id.assigner ? { assigner: id.assigner } : {}),
      };
    }
    if (id.type === "DL") {
      const dl = identifierToDriversLicense(id);
      if (dl) return dl;
    }
    return [];
  });

  return {
    firstName,
    lastName,
    dob,
    genderAtBirth,
    address,
    contact: [
      {
        phone,
        email,
      },
    ],
    personalIdentifiers,
  };
}

function identifierToDriversLicense(id: PatientIdentifier): DriversLicense | undefined {
  return fhirIdentifierToDriversLicense({
    system: id.system,
    value: id.value,
  });
}

function patientCollectionItemToCwLinkV2(networkLink: NetworkLink): CwLinkV2 {
  return {
    ...networkLink,
    version: 2,
  };
}
