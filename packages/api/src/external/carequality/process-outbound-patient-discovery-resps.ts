import { Patient } from "@metriport/core/domain/patient";
import { out } from "@metriport/core/util/log";
import { MedicalDataSource } from "@metriport/core/external/index";
import { elapsedTimeFromNow } from "@metriport/shared/common/date";
import { OutboundPatientDiscoveryRespParam } from "@metriport/core/external/carequality/ihe-gateway/outbound-result-poller-direct";
import { capture } from "@metriport/core/util/notifications";
import { OutboundPatientDiscoveryResp } from "@metriport/ihe-gateway-sdk";
import { errorToString } from "@metriport/shared/common/error";
import dayjs from "dayjs";
import duration from "dayjs/plugin/duration";
import { createOrUpdateCQPatientData } from "./command/cq-patient-data/create-cq-data";
import { CQLink } from "./cq-patient-data";
import { analytics, EventTypes } from "../../shared/analytics";
import { getPatientOrFail } from "../../command/medical/patient/get-patient";
import { getCQData, discover } from "./patient";
import { resetPatientScheduledDocQueryRequestId } from "../hie/reset-scheduled-doc-query-request-id";
import { resetPatientScheduledPatientDiscoveryRequestId } from "../hie/reset-scheduled-patient-discovery-request-id";
import { getDocumentsFromCQ } from "./document/query-documents";
import { updatePatientDiscoveryStatus } from "./command/update-patient-discovery-status";
import { updateDemographics } from "./patient-demographics";

dayjs.extend(duration);

const context = "cq.patient.discover";

export async function processOutboundPatientDiscoveryResps({
  requestId,
  patientId,
  cxId,
  results,
}: OutboundPatientDiscoveryRespParam): Promise<void> {
  const { log } = out(`CQ PD Processing results - patientId ${patientId}, requestId: ${requestId}`);
  const patientIds = { id: patientId, cxId };

  try {
    const patient = await getPatientOrFail(patientIds);

    log(`Starting to handle patient discovery results`);
    const cqLinks = await createCQLinks(
      {
        id: patientId,
        cxId,
      },
      results
    );

    const pdRequestId = getCQData(patient.data.externalData)?.pdRequestId;
    const pdStartedAt = getCQData(patient.data.externalData)?.pdStartedAt;
    const pdEndeddAt = getCQData(patient.data.externalData)?.pdEndedAt;

    if (requestId === pdRequestId && pdStartedAt && !pdEndeddAt) {
      analytics({
        distinctId: patient.cxId,
        event: EventTypes.patientDiscovery,
        properties: {
          hie: MedicalDataSource.CAREQUALITY,
          patientId: patient.id,
          requestId,
          pdLinks: cqLinks.length,
          duration: elapsedTimeFromNow(pdStartedAt),
        },
      });
    }

    if (results.length > 0) await updateDemographics(patient, results);

    const newPatientDiscovery = await patientDiscoveryIfScheduled(patient);

    if (!newPatientDiscovery) {
      await updatePatientDiscoveryStatus({
        patient: patientIds,
        status: "completed",
        endedAt: new Date(),
      });

      await queryDocsIfScheduled(patient);
    }
  } catch (error) {
    await updatePatientDiscoveryStatus({
      patient: patientIds,
      status: "failed",
      endedAt: new Date(),
    });
    const msg = `Error on Processing Outbound Patient Discovery Responses`;
    console.error(`${msg}. Patient ID: ${patientIds.id}. Cause: ${errorToString(error)}`);
    capture.error(msg, {
      extra: {
        patientId,
        results,
        context,
        error,
      },
    });
    // Why are we not throwing this error?
    throw error;
  }
}

async function queryDocsIfScheduled(patient: Patient): Promise<void> {
  const updatedPatient = await getPatientOrFail(patient);

  const scheduledDocQueryRequestId = getCQData(
    updatedPatient.data.externalData
  )?.scheduledDocQueryRequestId;

  if (scheduledDocQueryRequestId) {
    const resetPatient = await resetPatientScheduledDocQueryRequestId({
      patient: updatedPatient,
      source: MedicalDataSource.CAREQUALITY,
    });

    await getDocumentsFromCQ({
      patient: resetPatient,
      requestId: scheduledDocQueryRequestId,
    });
  }
}

async function patientDiscoveryIfScheduled(patient: Patient): Promise<boolean> {
  const updatedPatient = await getPatientOrFail(patient);

  const cqData = getCQData(updatedPatient.data.externalData);

  const facilityId = cqData?.pdFacilityId;
  const scheduledPdRequestId = cqData?.scheduledPdRequestId;

  let newPatientDiscovery = false;
  if (facilityId && scheduledPdRequestId) {
    const resetPatient = await resetPatientScheduledPatientDiscoveryRequestId({
      patient: updatedPatient,
      source: MedicalDataSource.CAREQUALITY,
    });

    await discover(resetPatient, facilityId, scheduledPdRequestId);

    newPatientDiscovery = true;
  }
  return newPatientDiscovery;
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
    };
  });
}
