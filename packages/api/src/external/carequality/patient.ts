import { Patient, PatientExternalData } from "@metriport/core/domain/patient";
import { toIheGatewayPatientResource } from "@metriport/core/external/carequality/ihe-gateway-v2/patient";
import { MedicalDataSource } from "@metriport/core/external/index";
import { processAsyncError } from "@metriport/core/util/error/shared";
import { out } from "@metriport/core/util/log";
import { capture } from "@metriport/core/util/notifications";
import { uuidv7 } from "@metriport/core/util/uuid-v7";
import { IHEGateway, OutboundPatientDiscoveryReq } from "@metriport/ihe-gateway-sdk";
import { errorToString } from "@metriport/shared";
import dayjs from "dayjs";
import duration from "dayjs/plugin/duration";
import { makeIHEGatewayV2 } from "../ihe-gateway-v2/ihe-gateway-v2-factory";
import { makeOutboundResultPoller } from "../ihe-gateway/outbound-result-poller-factory";
import { deleteCQPatientData } from "./command/cq-patient-data/delete-cq-data";
import { createOutboundPatientDiscoveryReq } from "./create-outbound-patient-discovery-req";
import { gatherXCPDGateways } from "./gateway";
import { PatientDataCarequality } from "./patient-shared";
import { updatePatientDiscoveryStatus } from "./command/update-patient-discovery-status";
import { getCqInitiator, validateCQEnabledAndInitGW } from "./shared";
import { queryDocsIfScheduled } from "./process-outbound-patient-discovery-resps";
import { createAugmentedPatient } from "../../domain/medical/patient-demographics";
import { resetScheduledPatientDiscovery } from "../hie/reset-scheduled-patient-discovery-request";

dayjs.extend(duration);

const context = "cq.patient.discover";
const resultPoller = makeOutboundResultPoller();

export async function discover({
  patient,
  facilityId,
  requestId: inputRequestId,
  forceEnabled = false,
  rerunPdOnNewDemographics = false,
}: {
  patient: Patient;
  facilityId: string;
  requestId?: string;
  forceEnabled?: boolean;
  rerunPdOnNewDemographics?: boolean;
}): Promise<void> {
  const baseLogMessage = `CQ PD - patientId ${patient.id}`;
  const { log: outerLog } = out(baseLogMessage);

  const enabledIHEGW = await validateCQEnabledAndInitGW(
    patient,
    facilityId,
    forceEnabled,
    outerLog
  );

  if (enabledIHEGW) {
    const requestId = inputRequestId ?? uuidv7();
    const startedAt = new Date();
    const updatedPatient = await updatePatientDiscoveryStatus({
      patient,
      status: "processing",
      params: {
        requestId,
        facilityId,
        startedAt,
        rerunPdOnNewDemographics,
      },
    });

    // Intentionally asynchronous
    prepareAndTriggerPD({
      patient: createAugmentedPatient(updatedPatient),
      facilityId,
      enabledIHEGW,
      requestId,
      baseLogMessage,
    }).catch(processAsyncError(context));
  }
}

async function prepareAndTriggerPD({
  patient,
  facilityId,
  enabledIHEGW,
  requestId,
  baseLogMessage,
}: {
  patient: Patient;
  facilityId: string;
  enabledIHEGW: IHEGateway;
  requestId: string;
  baseLogMessage: string;
}): Promise<void> {
  try {
    const { pdRequestGatewayV1, pdRequestGatewayV2 } = await prepareForPatientDiscovery(
      patient,
      facilityId,
      requestId
    );
    const numGatewaysV1 = pdRequestGatewayV1.gateways.length;
    const numGatewaysV2 = pdRequestGatewayV2.gateways.length;

    const { log } = out(
      `${baseLogMessage}, requestIdV1: ${pdRequestGatewayV1.id}, requestIdV2: ${pdRequestGatewayV2.id}`
    );

    log(`Kicking off patient discovery Gateway V1`);
    await enabledIHEGW.startPatientDiscovery(pdRequestGatewayV1);

    log(`Kicking off patient discovery Gateway V2`);
    const iheGatewayV2 = makeIHEGatewayV2();
    await iheGatewayV2.startPatientDiscovery({
      pdRequestGatewayV2,
      patientId: patient.id,
      cxId: patient.cxId,
    });

    // only poll for the Gateway V1 request
    await resultPoller.pollOutboundPatientDiscoveryResults({
      requestId: pdRequestGatewayV1.id,
      patientId: patient.id,
      cxId: patient.cxId,
      numOfGateways: numGatewaysV1 + numGatewaysV2,
    });
  } catch (error) {
    // TODO 1646 Move to a single hit to the DB
    await resetScheduledPatientDiscovery({
      patient,
      source: MedicalDataSource.CAREQUALITY,
    });
    await updatePatientDiscoveryStatus({ patient, status: "failed" });
    await queryDocsIfScheduled({ patientIds: patient, isFailed: true });
    const msg = `Error on Patient Discovery`;
    out(baseLogMessage).log(`${msg} - ${errorToString(error)}`);
    capture.error(msg, {
      extra: {
        facilityId,
        patientId: patient.id,
        context,
        error,
      },
    });
  }
}

async function prepareForPatientDiscovery(
  patient: Patient,
  facilityId: string,
  requestId: string
): Promise<{
  pdRequestGatewayV1: OutboundPatientDiscoveryReq;
  pdRequestGatewayV2: OutboundPatientDiscoveryReq;
}> {
  const patientResource = toIheGatewayPatientResource(patient);

  const [{ v1Gateways, v2Gateways }, initiator] = await Promise.all([
    gatherXCPDGateways(patient),
    getCqInitiator(patient, facilityId),
  ]);

  const pdRequestGatewayV1 = createOutboundPatientDiscoveryReq({
    patientResource,
    cxId: patient.cxId,
    patientId: patient.id,
    xcpdGateways: v1Gateways,
    requestId: requestId,
    initiator,
  });

  const pdRequestGatewayV2 = createOutboundPatientDiscoveryReq({
    patientResource,
    cxId: patient.cxId,
    patientId: patient.id,
    xcpdGateways: v2Gateways,
    requestId: requestId,
    initiator,
  });

  return {
    pdRequestGatewayV1,
    pdRequestGatewayV2,
  };
}

export function getCQData(
  data: PatientExternalData | undefined
): PatientDataCarequality | undefined {
  if (!data) return undefined;
  return data[MedicalDataSource.CAREQUALITY] as PatientDataCarequality; // TODO validate the type
}

export async function remove(patient: Patient): Promise<void> {
  const { log } = out(`cq.patient.remove - M patientId ${patient.id}`);
  log(`Deleting CQ data`);
  await deleteCQPatientData({ id: patient.id, cxId: patient.cxId });
}
