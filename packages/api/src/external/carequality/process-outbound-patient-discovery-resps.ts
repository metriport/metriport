import { Patient } from "@metriport/core/domain/patient";
import { out } from "@metriport/core/util/log";
import { MedicalDataSource } from "@metriport/core/external/index";
import { elapsedTimeFromNow } from "@metriport/shared/common/date";
import { OutboundPatientDiscoveryRespParam } from "@metriport/core/external/carequality/ihe-gateway/outbound-result-poller-direct";
import { capture } from "@metriport/core/util/notifications";
import { OutboundPatientDiscoveryResp, InboundPatientResource } from "@metriport/ihe-gateway-sdk";
import { errorToString } from "@metriport/shared/common/error";
import dayjs from "dayjs";
import duration from "dayjs/plugin/duration";
import { createOrUpdateCQPatientData } from "./command/cq-patient-data/create-cq-data";
import { testAndUpdatePatientDemographics } from "./command/test-and-update-patient-demographics";
import { CQLink } from "./cq-patient-data";
import { processPatientDiscoveryProgress } from "./process-patient-discovery-progress";
import { analytics, EventTypes } from "../../shared/analytics";
import { getPatientOrFail } from "../../command/medical/patient/get-patient";

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
    if (results.length === 0) {
      log(`No patient discovery results found.`);
      await processPatientDiscoveryProgress({ patient: patientIds, status: "completed" });
      return;
    }

    log(`Updating patient demographics`);
    const patientDemoAugmented: boolean = await augmentPatientDemographics(
      {
        id: patientId,
        cxId,
      },
      results
    );

    log(`Starting to handle patient discovery results`);
    const cqLinks = await createCQLinks(
      {
        id: patientId,
        cxId,
      },
      results
    );

    await processPatientDiscoveryProgress({
      patient: patientIds,
      status: patientDemoAugmented ? "re-run" : "completed",
    });

    const patient = await getPatientOrFail({ id: patientId, cxId });
    const startedAt = patient.data.patientDiscovery?.startedAt;

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

    log(`Completed.`);
  } catch (error) {
    const msg = `Error on Processing Outbound Patient Discovery Responses`;
    outerLog(`${msg} - ${errorToString(error)}`);
    await processPatientDiscoveryProgress({ patient: patientIds, status: "failed" });
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
    };
  });
}

async function augmentPatientDemographics(
  patient: Pick<Patient, "id" | "cxId">,
  pdResults: OutboundPatientDiscoveryResp[]
): Promise<boolean> {
  const patientResources = fetchPatientResources(pdResults);
  const successfulAugmentations = await Promise.all(
    patientResources.map(async patientResource => {
      return await testAndUpdatePatientDemographics({
        patient,
        patientResource,
      });
    })
  );
  return successfulAugmentations.some(isAugmented => isAugmented === true);
}

function fetchPatientResources(
  pdResults: OutboundPatientDiscoveryResp[]
): InboundPatientResource[] {
  return pdResults.flatMap(pd => {
    const match = pd.patientMatch;
    if (!match) return [];
    const patientResource = pd.patientResource;
    if (!patientResource) return [];
    return patientResource;
  });
}
