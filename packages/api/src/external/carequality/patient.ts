import { Patient, PatientExternalData } from "@metriport/core/domain/patient";
import { toIheGatewayPatientResource } from "@metriport/core/external/carequality/ihe-gateway-v2/patient";
import { MedicalDataSource } from "@metriport/core/external/index";
import { processAsyncError } from "@metriport/core/util/error/shared";
import { out } from "@metriport/core/util/log";
import { capture } from "@metriport/core/util/notifications";
import { IHEGateway, OutboundPatientDiscoveryReq, XCPDGateway } from "@metriport/ihe-gateway-sdk";
import dayjs from "dayjs";
import duration from "dayjs/plugin/duration";
import { makeOutboundResultPoller } from "../ihe-gateway/outbound-result-poller-factory";
import { getOrganizationsForXCPD } from "./command/cq-directory/get-organizations-for-xcpd";
import {
  filterCQOrgsToSearch,
  searchCQDirectoriesAroundPatientAddresses,
  toBasicOrgAttributes,
} from "./command/cq-directory/search-cq-directory";
import { deleteCQPatientData } from "./command/cq-patient-data/delete-cq-data";
import { createOutboundPatientDiscoveryReq } from "./create-outbound-patient-discovery-req";
import { cqOrgsToXCPDGateways } from "./organization-conversion";
import { PatientDataCarequality } from "./patient-shared";
import { getCqInitiator, validateCQEnabledAndInitGW } from "./shared";
import { makeIHEGatewayV2 } from "../ihe-gateway-v2/ihe-gateway-v2-factory";
import { processPatientDiscoveryProgress } from "./process-patient-discovery-progress";

dayjs.extend(duration);

const context = "cq.patient.discover";
const resultPoller = makeOutboundResultPoller();

export async function discover(
  patient: Patient,
  facilityId: string,
  requestId: string,
  forceEnabled = false
): Promise<void> {
  const baseLogMessage = `CQ PD - patientId ${patient.id}`;
  const { log: outerLog } = out(baseLogMessage);

  const enabledIHEGW = await validateCQEnabledAndInitGW(
    patient,
    facilityId,
    forceEnabled,
    outerLog
  );

  if (enabledIHEGW) {
    await processPatientDiscoveryProgress({ patient, status: "processing" });

    // Intentionally asynchronous
    prepareAndTriggerPD(patient, facilityId, enabledIHEGW, requestId, baseLogMessage).catch(
      processAsyncError(context)
    );
  }
}

async function prepareAndTriggerPD(
  patient: Patient,
  facilityId: string,
  enabledIHEGW: IHEGateway,
  requestId: string,
  baseLogMessage: string
): Promise<void> {
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
    const msg = `Error on Patient Discovery`;
    await processPatientDiscoveryProgress({ patient, status: "failed" });
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

export async function gatherXCPDGateways(patient: Patient): Promise<{
  v1Gateways: XCPDGateway[];
  v2Gateways: XCPDGateway[];
}> {
  const nearbyOrgsWithUrls = await searchCQDirectoriesAroundPatientAddresses({
    patient,
    mustHaveXcpdLink: true,
  });
  const orgOrderMap = new Map<string, number>();

  nearbyOrgsWithUrls.forEach((org, index) => {
    orgOrderMap.set(org.id, index);
  });

  const allOrgs = await getOrganizationsForXCPD(orgOrderMap);
  const allOrgsWithBasics = allOrgs.map(toBasicOrgAttributes);
  const orgsToSearch = filterCQOrgsToSearch(allOrgsWithBasics);
  const { v1Gateways, v2Gateways } = await cqOrgsToXCPDGateways(orgsToSearch);

  return {
    v1Gateways,
    v2Gateways,
  };
}

export function getCQData(
  data: PatientExternalData | undefined
): PatientDataCarequality | undefined {
  if (!data) return undefined;
  return data[MedicalDataSource.CAREQUALITY] as PatientDataCarequality; // TODO validate the type
}

export async function remove(patient: Patient): Promise<void> {
  console.log(`Deleting CQ data - M patientId ${patient.id}`);
  await deleteCQPatientData({ id: patient.id, cxId: patient.cxId });
}
