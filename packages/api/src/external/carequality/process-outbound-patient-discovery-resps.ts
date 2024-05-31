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
import { ScheduledPatientDiscovery } from "../hie/schedule-patient-discovery";
import { resetPatientScheduledPatientDiscoveryRequestId } from "../hie/reset-scheduled-patient-discovery-request";
import { updatePatientLinkDemographics } from "../hie/update-patient-link-demographics";
import { checkLinkDemographicsAcrossHies } from "../hie/check-patient-link-demographics";
import { resetPatientScheduledDocQueryRequestId } from "../hie/reset-scheduled-doc-query-request-id";
import { getCQData, discover } from "./patient";
import { getNewDemographics } from "./patient-demographics";

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
    // BUG This prevents analytics from firing for valid cases of no links
    if (results.length === 0) {
      log(`No patient discovery results found.`);
      await updatePatientDiscoveryStatus({ patient: patientIds, status: "completed" });
      return;
    }

    log(`Starting to handle patient discovery results`);
    const cqLinks = await createCQLinks(
      {
        id: patientId,
        cxId,
      },
      results
    );

    const patient = await getPatientOrFail({ id: patientId, cxId });

    const cqData = getCQData(patient.data.externalData);
    const startedAt = cqData?.discoveryStartedAt;

    analytics({
      distinctId: patient.cxId,
      event: EventTypes.patientDiscovery,
      properties: {
        hie: MedicalDataSource.CAREQUALITY,
        patientId: patient.id,
        requestId,
        pdLinks: cqLinks.length,
        duration: elapsedTimeFromNow(startedAt),
      },
    });

    const facilityId = cqData?.discoveryFacilityId;
    const rerunPdOnNewDemographics = cqData?.discoveryRerunPdOnNewDemographics;
    if (rerunPdOnNewDemographics && facilityId) {
      const startedNewPd = await handleRerunPdOnNewDemographics({
        patient,
        facilityId,
        requestId,
        cqLinks,
      });
      if (startedNewPd) return;
    }

    const scheduledPdRequest = cqData?.scheduledPdRequest;
    if (scheduledPdRequest) {
      handleNextPdIfScheduled({
        patient,
        scheduledPdRequest,
      });
    } else {
      updatePatientDiscoveryStatus({ patient, status: "completed" });
    }

    await queryDocsIfScheduled({ patient });
  } catch (error) {
    await resetPatientScheduledPatientDiscoveryRequestId({
      patient: patientIds,
      source: MedicalDataSource.CAREQUALITY,
    });
    await updatePatientDiscoveryStatus({ patient: patientIds, status: "failed" });
    await queryDocsIfScheduled({ patient: patientIds, isFailed: true });
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

  if (cqLinks.length) await createOrUpdateCQPatientData({ id, cxId, cqLinks });

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

async function handleRerunPdOnNewDemographics({
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
  const foundNewDemographicsAcrossHies = checkLinkDemographicsAcrossHies({
    patient,
    requestId,
  });
  const newDemographicsHere = getNewDemographics(patient, cqLinks);
  const foundNewDemographicsHere = newDemographicsHere.length > 0;
  const rerunPd = foundNewDemographicsHere || foundNewDemographicsAcrossHies;
  if (rerunPd) {
    if (foundNewDemographicsHere) {
      await updatePatientLinkDemographics({
        requestId,
        patient,
        source: MedicalDataSource.CAREQUALITY,
        links: newDemographicsHere,
      });
    }
    await discover({
      patient,
      facilityId,
      requestId,
      rerunPdOnNewDemographics: false,
    });
  }
  return rerunPd;
}

async function handleNextPdIfScheduled({
  patient,
  scheduledPdRequest,
}: {
  patient: Patient;
  scheduledPdRequest: ScheduledPatientDiscovery;
}): Promise<void> {
  await discover({
    patient,
    facilityId: scheduledPdRequest.facilityId,
    requestId: scheduledPdRequest.requestId,
    rerunPdOnNewDemographics: scheduledPdRequest.rerunPdOnNewDemographics,
  });

  await resetPatientScheduledPatientDiscoveryRequestId({
    patient,
    source: MedicalDataSource.CAREQUALITY,
  });
}

export async function queryDocsIfScheduled({
  patient,
  isFailed = false,
}: {
  patient: Pick<Patient, "id" | "cxId">;
  isFailed?: boolean;
}): Promise<void> {
  const updatedPatient = await getPatientOrFail(patient);

  const scheduledDocQueryRequestId = getCQData(
    updatedPatient.data.externalData
  )?.scheduledDocQueryRequestId;

  if (scheduledDocQueryRequestId) {
    const resetPatient = await resetPatientScheduledDocQueryRequestId({
      patient: updatedPatient,
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
      await getDocumentsFromCQ({
        patient: resetPatient,
        requestId: scheduledDocQueryRequestId,
      });
    }
  }
}
