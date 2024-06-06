import { Patient } from "@metriport/core/domain/patient";
import { out } from "@metriport/core/util/log";
import { MedicalDataSource } from "@metriport/core/external/index";
import { elapsedTimeFromNow } from "@metriport/shared/common/date";
import { analytics, EventTypes } from "@metriport/core/external/analytics/posthog";
import { OutboundPatientDiscoveryRespParam } from "@metriport/core/external/carequality/ihe-gateway/outbound-result-poller-direct";
import { capture } from "@metriport/core/util/notifications";
import { OutboundPatientDiscoveryResp } from "@metriport/ihe-gateway-sdk";
import { errorToString } from "@metriport/shared/common/error";
import dayjs from "dayjs";
import duration from "dayjs/plugin/duration";
import { createOrUpdateCQPatientData } from "./command/cq-patient-data/create-cq-data";
import { CQLink } from "./cq-patient-data";
import { updatePatientDiscoveryStatus } from "./command/update-patient-discovery-status";
import { getPatientOrFail } from "../../command/medical/patient/get-patient";
import { getDocumentsFromCQ } from "./document/query-documents";
import { setDocQueryProgress } from "../hie/set-doc-query-progress";
import { resetScheduledPatientDiscovery } from "../hie/reset-scheduled-patient-discovery-request";
import { updatePatientLinkDemographics } from "../hie/update-patient-link-demographics";
import { checkLinkDemographicsAcrossHies } from "../hie/check-patient-link-demographics";
import { resetPatientScheduledDocQueryRequestId } from "../hie/reset-scheduled-doc-query-request-id";
import { getCQData, discover } from "./patient";
import { getNewDemographics } from "./patient-demographics";
import { processAsyncError } from "@metriport/core/util/error/shared";

dayjs.extend(duration);

const context = "cq.patient.discover";

export async function processOutboundPatientDiscoveryResps({
  requestId,
  patientId,
  cxId,
  results,
}: OutboundPatientDiscoveryRespParam): Promise<void> {
  const baseLogMessage = `CQ PD Processing results - patientId ${patientId}`;
  const { log } = out(`${baseLogMessage}, requestId: ${requestId}`);
  const { log: outerLog } = out(baseLogMessage);
  const patientIds = { id: patientId, cxId };

  try {
    const patient = await getPatientOrFail({ id: patientId, cxId });
    // ANALYTICS BUG This prevents analytics from firing for valid cases of no results
    // TODO Internal 1848 (fix)
    if (results.length === 0) {
      log(`No patient discovery results found.`);
      const startedNewPd = await runNexPdIfScheduled({
        patient,
        requestId,
      });
      if (startedNewPd) return;
      await updatePatientDiscoveryStatus({ patient: patientIds, status: "completed" });
      await queryDocsIfScheduled({ patientIds });
    }

    log(`Starting to handle patient discovery results`);
    const cqLinks = await createCQLinks(
      {
        id: patientId,
        cxId,
      },
      results
    );

    const discoveryParams = getCQData(patient.data.externalData)?.discoveryParams;
    if (!discoveryParams) {
      // Backward compatability during deployment phase
      await updatePatientDiscoveryStatus({ patient, status: "completed" });
      await queryDocsIfScheduled({ patientIds: patient });
      return;
      //const msg = `Failed to find discovery params @ CQ`;
      //log(`${msg}. Patient ID: ${patient.id}.`);
      //throw new Error(msg);
    }

    if (discoveryParams.rerunPdOnNewDemographics) {
      const startedNewPd = await runNextPdOnNewDemographics({
        patient,
        facilityId: discoveryParams.facilityId,
        requestId,
        cqLinks,
      });
      if (startedNewPd) return;
    }

    analytics({
      distinctId: patient.cxId,
      event: EventTypes.patientDiscovery,
      properties: {
        hie: MedicalDataSource.CAREQUALITY,
        patientId: patient.id,
        requestId,
        pdLinks: cqLinks.length,
        duration: elapsedTimeFromNow(discoveryParams.startedAt),
      },
    });

    const startedNewPd = await runNexPdIfScheduled({
      patient,
      requestId,
    });
    if (startedNewPd) return;
    await updatePatientDiscoveryStatus({ patient, status: "completed" });
    await queryDocsIfScheduled({ patientIds: patient });
    log("Completed.");
  } catch (error) {
    // TODO 1646 Move to a single hit to the DB
    await resetScheduledPatientDiscovery({
      patient: patientIds,
      source: MedicalDataSource.CAREQUALITY,
    });
    await updatePatientDiscoveryStatus({ patient: patientIds, status: "failed" });
    await queryDocsIfScheduled({ patientIds, isFailed: true });
    const msg = `Error on Processing Outbound Patient Discovery Responses`;
    outerLog(`${msg} - ${errorToString(error)}`);
    capture.error(msg, {
      extra: {
        patientId,
        results,
        context,
        error,
      },
    });
  }
}

async function createCQLinks(
  patient: Pick<Patient, "id" | "cxId">,
  pdResults: OutboundPatientDiscoveryResp[]
): Promise<CQLink[]> {
  const { id, cxId } = patient;
  const cqLinks = buildCQLinks(pdResults);

  if (cqLinks.length > 0) await createOrUpdateCQPatientData({ id, cxId, cqLinks });

  return cqLinks;
}

function buildCQLinks(pdResults: OutboundPatientDiscoveryResp[]): CQLink[] {
  return pdResults.flatMap(pd => {
    const id = pd.externalGatewayPatient?.id;
    const system = pd.externalGatewayPatient?.system;
    const url = pd.gateway.url;
    if (!id || !system || !url) return [];
    return {
      patientId: id,
      systemId: system,
      oid: pd.gateway.oid,
      url,
      id: pd.gateway.id,
      ...(pd.patientMatch ? { patientResource: pd.patientResource } : undefined),
    };
  });
}

export async function runNextPdOnNewDemographics({
  patient,
  facilityId,
  requestId,
  cqLinks,
}: {
  patient: Patient;
  facilityId: string;
  requestId: string;
  cqLinks: CQLink[];
}): Promise<boolean> {
  const updatedPatient = await getPatientOrFail(patient);

  const newDemographicsHere = getNewDemographics(updatedPatient, cqLinks);
  const foundNewDemographicsHere = newDemographicsHere.length > 0;
  const foundNewDemographicsAcrossHies = await checkLinkDemographicsAcrossHies({
    patient: updatedPatient,
    requestId,
  });
  if (!foundNewDemographicsHere && !foundNewDemographicsAcrossHies) {
    return false;
  }

  if (foundNewDemographicsHere) {
    await updatePatientLinkDemographics({
      requestId,
      patient: updatedPatient,
      source: MedicalDataSource.CAREQUALITY,
      links: newDemographicsHere,
    });
  }
  discover({
    patient: updatedPatient,
    facilityId,
    rerunPdOnNewDemographics: false,
  }).catch(processAsyncError("CQ discover"));
  analytics({
    distinctId: updatedPatient.cxId,
    event: EventTypes.rerunOnNewDemographics,
    properties: {
      hie: MedicalDataSource.CAREQUALITY,
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

  const scheduledPdRequest = getCQData(updatedPatient.data.externalData)?.scheduledPdRequest;
  if (!scheduledPdRequest) {
    return false;
  }

  await resetScheduledPatientDiscovery({
    patient: updatedPatient,
    source: MedicalDataSource.CAREQUALITY,
  });
  discover({
    patient: updatedPatient,
    facilityId: scheduledPdRequest.facilityId,
    requestId: scheduledPdRequest.requestId,
    forceEnabled: scheduledPdRequest.forceCarequality,
    rerunPdOnNewDemographics: scheduledPdRequest.rerunPdOnNewDemographics,
  }).catch(processAsyncError("CQ discover"));
  analytics({
    distinctId: updatedPatient.cxId,
    event: EventTypes.runScheduledPatientDiscovery,
    properties: {
      hie: MedicalDataSource.CAREQUALITY,
      patientId: updatedPatient.id,
      requestId,
      scheduledPdRequestId: scheduledPdRequest.requestId,
    },
  });
  return true;
}

export async function queryDocsIfScheduled({
  patientIds,
  isFailed = false,
}: {
  patientIds: Pick<Patient, "id" | "cxId">;
  isFailed?: boolean;
}): Promise<void> {
  const patient = await getPatientOrFail(patientIds);

  const scheduledDocQueryRequestId = getCQData(
    patient.data.externalData
  )?.scheduledDocQueryRequestId;
  if (!scheduledDocQueryRequestId) {
    return;
  }

  await resetPatientScheduledDocQueryRequestId({
    patient,
    source: MedicalDataSource.CAREQUALITY,
  });
  if (isFailed) {
    await setDocQueryProgress({
      patient,
      requestId: scheduledDocQueryRequestId,
      source: MedicalDataSource.CAREQUALITY,
      downloadProgress: { status: "failed", total: 0 },
      convertProgress: { status: "failed", total: 0 },
    });
  } else {
    getDocumentsFromCQ({
      patient,
      requestId: scheduledDocQueryRequestId,
    }).catch(processAsyncError("CQ getDocumentsFromCQ"));
  }
}
