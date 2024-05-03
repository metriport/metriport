import { Patient, PatientExternalData } from "@metriport/core/domain/patient";
import { toFHIR } from "@metriport/core/external/fhir/patient/index";
import { MedicalDataSource } from "@metriport/core/external/index";
import { processAsyncError } from "@metriport/core/util/error/shared";
import { out } from "@metriport/core/util/log";
import { capture } from "@metriport/core/util/notifications";
import { IHEGateway, OutboundPatientDiscoveryReq, XCPDGateways } from "@metriport/ihe-gateway-sdk";
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
import { cqOrgsToXCPDGateways, generateIdsForGateways } from "./organization-conversion";
import { PatientDataCarequality } from "./patient-shared";
import { updatePatientDiscoveryStatus } from "./command/update-patient-discovery-status";
import { getCqInitiator, validateCQEnabledAndInitGW } from "./shared";

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
  const { cxId } = patient;

  const enabledIHEGW = await validateCQEnabledAndInitGW(cxId, forceEnabled, outerLog);

  if (enabledIHEGW) {
    await updatePatientDiscoveryStatus({
      patient,
      status: "processing",
      requestId,
      startedAt: new Date(),
    });

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
    const pdRequest = await prepareForPatientDiscovery(patient, facilityId, requestId);
    const numGateways = pdRequest.gateways.length;

    const { log } = out(`${baseLogMessage}, requestId: ${requestId}`);

    log(`Kicking off patient discovery`);
    await enabledIHEGW.startPatientDiscovery(pdRequest);

    await resultPoller.pollOutboundPatientDiscoveryResults({
      requestId,
      patientId: patient.id,
      cxId: patient.cxId,
      numOfGateways: numGateways,
    });
  } catch (error) {
    const msg = `Error on Patient Discovery`;
    await updatePatientDiscoveryStatus({ patient, status: "failed" });
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
): Promise<OutboundPatientDiscoveryReq> {
  const fhirPatient = toFHIR(patient);
  const [xcpdGateways, initiator] = await Promise.all([
    gatherXCPDGateways(patient),
    getCqInitiator(patient, facilityId),
  ]);

  const pdRequest = createOutboundPatientDiscoveryReq({
    patient: fhirPatient,
    cxId: patient.cxId,
    xcpdGateways,
    initiator,
    requestId,
  });
  return pdRequest;
}

async function gatherXCPDGateways(patient: Patient): Promise<XCPDGateways> {
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
  const xcpdGatewaysWithoutIds = cqOrgsToXCPDGateways(orgsToSearch);
  const xcpdGateways = generateIdsForGateways(xcpdGatewaysWithoutIds);

  return xcpdGateways;
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
