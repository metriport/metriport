import { Patient, PatientExternalData } from "@metriport/core/domain/patient";
import { toFHIR } from "@metriport/core/external/fhir/patient/index";
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
import { getCqInitiator, validateCQEnabledAndInitGW } from "./shared";
import { updatePatientDiscoveryStatus } from "./command/update-patient-discovery-status";
import { queryDocsIfScheduled } from "./process-outbound-patient-discovery-resps";
import { augmentPatientDemograhpics } from "./patient-demographics";

dayjs.extend(duration);

const context = "cq.patient.discover";
const resultPoller = makeOutboundResultPoller();

export async function discover({
  patient,
  facilityId,
  requestId,
  forceEnabled = false,
  rerunPdOnNewDemographics = false,
  augmentDemographics = false,
}: {
  patient: Patient;
  facilityId: string;
  requestId?: string;
  forceEnabled?: boolean;
  rerunPdOnNewDemographics?: boolean;
  augmentDemographics?: boolean;
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
    const discoveryRequestId = requestId ?? uuidv7();
    const discoveryStartedAt = new Date();
    const augmentedPatient = augmentDemographics
      ? await augmentPatientDemograhpics(patient)
      : patient;
    await updatePatientDiscoveryStatus({
      patient,
      status: "processing",
      discoveryRequestId,
      discoveryFacilityId: facilityId,
      discoveryStartedAt,
      rerunPdOnNewDemographics,
      augmentedDemographics: augmentDemographics
        ? {
            dob: augmentedPatient.data.dob,
            genderAtBirth: augmentedPatient.data.genderAtBirth,
            firstName: augmentedPatient.data.firstName,
            lastName: augmentedPatient.data.lastName,
            contact: augmentedPatient.data.contact,
            address: augmentedPatient.data.address,
            personalIdentifiers: augmentedPatient.data.personalIdentifiers,
          }
        : undefined,
    });

    // Intentionally asynchronous
    prepareAndTriggerPD({
      patient: augmentedPatient,
      facilityId,
      enabledIHEGW,
      requestId: discoveryRequestId,
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
    await updatePatientDiscoveryStatus({ patient, status: "failed" });
    await queryDocsIfScheduled({ patient, isFailed: true });
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
  const fhirPatient = toFHIR(patient);

  const [{ v1Gateways, v2Gateways }, initiator] = await Promise.all([
    gatherXCPDGateways(patient),
    getCqInitiator(patient, facilityId),
  ]);

  const pdRequestGatewayV1 = createOutboundPatientDiscoveryReq({
    patient: fhirPatient,
    cxId: patient.cxId,
    patientId: patient.id,
    xcpdGateways: v1Gateways,
    requestId: requestId,
    initiator,
  });

  const pdRequestGatewayV2 = createOutboundPatientDiscoveryReq({
    patient: fhirPatient,
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
