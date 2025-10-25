import {
  CommonWellAPI,
  Patient as CommonwellPatient,
  getCwPatientIdFromLinks,
} from "@metriport/commonwell-sdk";
import { decodeCwPatientIdV1, encodeCwPatientId } from "@metriport/commonwell-sdk/common/util";
import { Patient, PatientExternalData } from "@metriport/core/domain/patient";
import { LinkDemographics } from "@metriport/core/domain/patient-demographics";
import { analytics, EventTypes } from "@metriport/core/external/analytics/posthog";
import { MedicalDataSource } from "@metriport/core/external/index";
import { processAsyncError } from "@metriport/core/util/error/shared";
import { out } from "@metriport/core/util/log";
import { capture } from "@metriport/core/util/notifications";
import { errorToString, MetriportError } from "@metriport/shared";
import { elapsedTimeFromNow } from "@metriport/shared/common/date";
import dayjs from "dayjs";
import duration from "dayjs/plugin/duration";
import { getPatientOrFail } from "../../../command/medical/patient/get-patient";
import { getNewDemographics } from "../../../domain/medical/patient-demographics";
import { UpdatePatientCmd } from "../../commonwell/patient/command-types";
import { deleteCwPatientData } from "../../commonwell/patient/cw-patient-data/delete-cw-data";
import { updateCwPatientData } from "../../commonwell/patient/cw-patient-data/update-cw-data";
import {
  updateCommonwellIdsAndStatus,
  updatePatientDiscoveryStatus,
} from "../../commonwell/patient/patient-external-data";
import { PatientDataCommonwell } from "../../commonwell/patient/patient-shared";
import { getCwInitiator } from "../../commonwell/shared";
import { checkLinkDemographicsAcrossHies } from "../../hie/check-patient-link-demographics";
import { HieInitiator } from "../../hie/get-hie-initiator";
import { resetPatientScheduledDocQueryRequestId } from "../../hie/reset-scheduled-doc-query-request-id";
import { resetScheduledPatientDiscovery } from "../../hie/reset-scheduled-patient-discovery-request";
import { setDocQueryProgress } from "../../hie/set-doc-query-progress";
import { updatePatientLinkDemographics } from "../../hie/update-patient-link-demographics";
import { makeCommonWellAPI } from "../api";
import { queryAndProcessDocuments } from "../document/document-query";
import { runPatientLinkingWithRetries } from "./linking";
import { patientToCommonwell } from "./patient-conversion";
import { networkLinkToLinkDemographics } from "./patient-demographics";
import { NetworkLink } from "./types";

dayjs.extend(duration);

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

    debug(`Registering this Patient: `, () => JSON.stringify(commonwellPatient, null, 2));

    const { commonwellPatientId } = await registerPatient({
      commonWell,
      commonwellPatient,
      patient,
    });

    const { validLinks, invalidLinks } = await runPatientLinkingWithRetries({
      commonWell,
      patient,
      commonwellPatientId,
      context: createContext,
      getOrgIdExcludeList,
    });

    if (rerunPdOnNewDemographics) {
      const startedNewPd = await runNextPdOnNewDemographics({
        patient,
        facilityId,
        getOrgIdExcludeList,
        requestId,
        cwLinks: validLinks,
        update,
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

    debug("Completed.");
    return { commonwellPatientId };
  } catch (error) {
    // TODO 1646 Move to a single hit to the DB
    await resetScheduledPatientDiscovery({
      patient,
      source: MedicalDataSource.COMMONWELL,
    });
    await updatePatientDiscoveryStatus({ patient, status: "failed" });
    await queryDocsIfScheduled({ patientIds: patient, getOrgIdExcludeList, isFailed: true });

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

export async function updatePatientAndLinksInCwV2({
  patient,
  facilityId,
  getOrgIdExcludeList,
  rerunPdOnNewDemographics,
  requestId,
  startedAt,
  debug,
  update,
}: {
  patient: Patient;
  facilityId: string;
  getOrgIdExcludeList: () => Promise<string[]>;
  rerunPdOnNewDemographics: boolean;
  requestId: string;
  startedAt: Date;
  debug: typeof console.log;
  update: (params: UpdatePatientCmd) => Promise<void>;
}): Promise<void> {
  const { log } = out(`updatePatientAndLinksInCw.v2 - patientId ${patient.id}`);
  let commonWell: CommonWellAPI | undefined;

  try {
    const commonwellPatientId = getCommonwellPatientId(patient);
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
    });

    if (rerunPdOnNewDemographics) {
      const startedNewPd = await runNextPdOnNewDemographics({
        patient,
        facilityId,
        getOrgIdExcludeList,
        requestId,
        cwLinks: validLinks,
        update,
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
}: {
  patient: Patient;
  facilityId: string;
  getOrgIdExcludeList: () => Promise<string[]>;
  requestId: string;
  cwLinks: NetworkLink[];
  update: (params: UpdatePatientCmd) => Promise<void>;
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
  const scheduledDocQueryRequestForceDownload = cwData?.scheduledDocQueryRequestForceDownload;
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
      forceDownload: scheduledDocQueryRequestForceDownload,
      getOrgIdExcludeList,
    }).catch(processAsyncError("CW queryAndProcessDocuments"));
  }
}

export async function removeInCwV2(patient: Patient, facilityId: string): Promise<void> {
  const { log } = out(`CW.v2 delete - M patientId ${patient.id}`);
  let commonWell: CommonWellAPI | undefined;
  try {
    const commonwellPatientId = getCommonwellPatientId(patient);
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

export function getCommonwellPatientId(patient: Patient): string | undefined {
  const commonwellData = getCWData(patient.data.externalData);
  if (!commonwellData || !commonwellData.patientId) return undefined;
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
}: {
  commonWell: CommonWellAPI;
  commonwellPatient: CommonwellPatient;
  patient: Patient;
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

  await updateCommonwellIdsAndStatus({ patient, commonwellPatientId });

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
