import { Patient } from "@metriport/core/domain/patient";
import { out } from "@metriport/core/util/log";
import { MedicalDataSource } from "@metriport/core/external/index";
import { elapsedTimeFromNow } from "@metriport/shared/common/date";
import { analytics, EventTypes } from "@metriport/core/external/analytics/posthog";
import { OutboundPatientDiscoveryRespParam } from "@metriport/core/external/carequality/ihe-gateway/outbound-result-poller-direct";
import { capture } from "@metriport/core/util/notifications";
import { OutboundPatientDiscoveryResp } from "@metriport/ihe-gateway-sdk";
import { errorToString } from "@metriport/shared/common/error";
import { processAsyncError } from "@metriport/core/util/error/shared";
import dayjs from "dayjs";
import duration from "dayjs/plugin/duration";
import { createOrUpdateCQPatientData } from "./command/cq-patient-data/create-cq-data";
import { updateCQPatientData } from "./command/cq-patient-data/update-cq-data";
import { CQLink } from "./cq-patient-data";
import { updatePatientDiscoveryStatus } from "./command/update-patient-discovery-status";
import { getPatientOrFail } from "../../command/medical/patient/get-patient";
import { getNewDemographics } from "../../domain/medical/patient-demographics";
import { getDocumentsFromCQ } from "./document/query-documents";
import { setDocQueryProgress } from "../hie/set-doc-query-progress";
import { resetScheduledPatientDiscovery } from "../hie/reset-scheduled-patient-discovery-request";
import { updatePatientLinkDemographics } from "../hie/update-patient-link-demographics";
import { checkLinkDemographicsAcrossHies } from "../hie/check-patient-link-demographics";
import { resetPatientScheduledDocQueryRequestId } from "../hie/reset-scheduled-doc-query-request-id";
import { getCQData, discover } from "./patient";
import {
  getPatientResources,
  patientResourceToNormalizedLinkDemographics,
} from "./patient-demographics";
import { getOutboundPatientDiscoverySuccessFailureCount } from "../hie/carequality-analytics";
import { validateLinksBelongToPatient } from "../hie/validate-patient-links";
import { cqLinkToPatientData } from "./shared";
import { createOrUpdateInvalidLinks } from "../../command/medical/invalid-links/create-or-update-invalid-links";

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
  const countStats = getOutboundPatientDiscoverySuccessFailureCount(results);

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
    const cqLinks = await validateAndCreateCqLinks(patient, results);

    const discoveryParams = getCQData(patient.data.externalData)?.discoveryParams;
    if (!discoveryParams) {
      const msg = `Failed to find discovery params @ CQ`;
      log(`${msg}. Patient ID: ${patient.id}.`);
      throw new Error(msg);
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
        ...countStats,
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

async function validateAndCreateCqLinks(
  patient: Patient,
  pdResults: OutboundPatientDiscoveryResp[]
): Promise<CQLink[]> {
  const { id, cxId } = patient;
  const cqLinks = buildCQLinks(pdResults);

  const { validNetworkLinks, invalidLinks } = await validateLinksBelongToPatient<CQLink>(
    cxId,
    cqLinks,
    patient.data,
    cqLinkToPatientData
  );

  if (validNetworkLinks.length > 0) {
    await createOrUpdateCQPatientData({ id, cxId, cqLinks: validNetworkLinks });
  }

  if (invalidLinks.length > 0) {
    await createOrUpdateInvalidLinks({
      id,
      cxId,
      invalidLinks: {
        carequality: invalidLinks,
      },
    });
  }

  return validNetworkLinks;
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

  const linksDemographics = getPatientResources(cqLinks).map(
    patientResourceToNormalizedLinkDemographics
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
      updateCQPatientData({
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
        source: MedicalDataSource.CAREQUALITY,
        links: newDemographicsHere,
      }),
    ]);
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

  const cqData = getCQData(patient.data.externalData);
  const scheduledDocQueryRequestId = cqData?.scheduledDocQueryRequestId;
  const scheduledDocQueryRequestTriggerConsolidated =
    cqData?.scheduledDocQueryRequestTriggerConsolidated;
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
      triggerConsolidated: scheduledDocQueryRequestTriggerConsolidated,
    }).catch(processAsyncError("CQ getDocumentsFromCQ"));
  }
}
