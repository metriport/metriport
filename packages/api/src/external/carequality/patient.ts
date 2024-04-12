import { Patient, PatientExternalData } from "@metriport/core/domain/patient";
import { IHEGateway } from "@metriport/ihe-gateway-sdk";
import { processAsyncError } from "@metriport/core/util/error/shared";
import { Organization } from "@metriport/core/domain/organization";
import { toFHIR } from "@metriport/core/external/fhir/patient/index";
import { MedicalDataSource } from "@metriport/core/external/index";
import { out } from "@metriport/core/util/log";
import { capture } from "@metriport/core/util/notifications";
import { startPatientDiscoveryGirth } from "@metriport/core/external/carequality/ihe-gateway-v2/invoke-patient-discovery";
import { OutboundPatientDiscoveryReq, XCPDGateways } from "@metriport/ihe-gateway-sdk";
import dayjs from "dayjs";
import duration from "dayjs/plugin/duration";
import { getOrganizationOrFail } from "../../command/medical/organization/get-organization";

import { makeOutboundResultPoller } from "../ihe-gateway/outbound-result-poller-factory";
import { getOrganizationsForXCPD } from "./command/cq-directory/get-organizations-for-xcpd";
import {
  filterCQOrgsToSearch,
  searchCQDirectoriesAroundPatientAddresses,
  toBasicOrgAttributes,
} from "./command/cq-directory/search-cq-directory";
import { deleteCQPatientData } from "./command/cq-patient-data/delete-cq-data";
import { processPatientDiscoveryProgress } from "./process-patient-discovery-progress";
import { createOutboundPatientDiscoveryReq } from "./create-outbound-patient-discovery-req";
import { cqOrgsToXCPDGateways } from "./organization-conversion";
import { PatientDataCarequality } from "./patient-shared";
import { validateCQEnabledAndInitGW } from "./shared";

dayjs.extend(duration);

const context = "cq.patient.discover";
const resultPoller = makeOutboundResultPoller();

export async function discover(
  patient: Patient,
  facilityNPI: string,
  requestId: string,
  forceEnabled = false
): Promise<void> {
  const baseLogMessage = `CQ PD - patientId ${patient.id}`;
  const { log: outerLog } = out(baseLogMessage);
  const { cxId } = patient;

  const enabledIHEGW = await validateCQEnabledAndInitGW(cxId, forceEnabled, outerLog);

  if (enabledIHEGW) {
    await processPatientDiscoveryProgress({ patient, status: "processing" });

    // Intentionally asynchronous
    prepareAndTriggerPD(patient, facilityNPI, enabledIHEGW, requestId, baseLogMessage).catch(
      processAsyncError(context)
    );
  }
}

async function prepareAndTriggerPD(
  patient: Patient,
  facilityNPI: string,
  enabledIHEGW: IHEGateway,
  requestId: string,
  baseLogMessage: string
): Promise<void> {
  try {
    const [pdRequestNoGirth, pdRequestGirth] = await prepareForPatientDiscovery(
      patient,
      facilityNPI
    );
    const numGatewaysNoGirth = pdRequestNoGirth.gateways.length;

    const { log } = out(
      `${baseLogMessage}, requestIdNoGirth: ${pdRequestNoGirth.id}, requestIdGirth: ${pdRequestGirth.id}`
    );

    log(`Kicking off patient discovery NoGirth`);
    await enabledIHEGW.startPatientDiscovery(pdRequestNoGirth);

    log(`Kicking off patient discovery Girth`);
    await startPatientDiscoveryGirth({ pdRequestGirth, patientId: patient.id, cxId: patient.cxId });

    // only poll for the NoGirth request
    await resultPoller.pollOutboundPatientDiscoveryResults({
      requestId: pdRequestNoGirth.id,
      patientId: patient.id,
      cxId: patient.cxId,
      numOfGateways: numGatewaysNoGirth,
    });
  } catch (error) {
    const msg = `Error on Patient Discovery`;
    await processPatientDiscoveryProgress({ patient, status: "failed" });
    capture.error(msg, {
      extra: {
        facilityNPI,
        patientId: patient.id,
        context,
        error,
      },
    });
  }
}

async function prepareForPatientDiscovery(
  patient: Patient,
  facilityNPI: string,
  requestId?: string
): Promise<[OutboundPatientDiscoveryReq, OutboundPatientDiscoveryReq]> {
  const fhirPatient = toFHIR(patient);

  const { organization, xcpdGatewaysWithoutGirthEnabled, xcpdGatewaysWithGirthEnabled } =
    await gatherXCPDGateways(patient);

  // split xcpd gateways into two buckets here. Not Girth and Girth
  const pdRequestNoGirth = createOutboundPatientDiscoveryReq({
    patient: fhirPatient,
    cxId: patient.cxId,
    xcpdGateways: xcpdGatewaysWithoutGirthEnabled,
    facilityNPI,
    orgName: organization.data.name,
    orgOid: organization.oid,
    requestId: requestId,
  });

  const pdRequestGirth = createOutboundPatientDiscoveryReq({
    patient: fhirPatient,
    cxId: patient.cxId,
    xcpdGateways: xcpdGatewaysWithGirthEnabled,
    facilityNPI,
    orgName: organization.data.name,
    orgOid: organization.oid,
    requestId: requestId,
  });

  return [pdRequestNoGirth, pdRequestGirth];
}

export async function gatherXCPDGateways(patient: Patient): Promise<{
  organization: Organization;
  xcpdGatewaysWithoutGirthEnabled: XCPDGateways;
  xcpdGatewaysWithGirthEnabled: XCPDGateways;
}> {
  const nearbyOrgsWithUrls = await searchCQDirectoriesAroundPatientAddresses({
    patient,
    mustHaveXcpdLink: true,
  });
  const orgOrderMap = new Map<string, number>();

  nearbyOrgsWithUrls.forEach((org, index) => {
    orgOrderMap.set(org.id, index);
  });

  const [organization, allOrgs] = await Promise.all([
    getOrganizationOrFail({ cxId: patient.cxId }),
    getOrganizationsForXCPD(orgOrderMap),
  ]);

  const allOrgsWithBasics = allOrgs.map(toBasicOrgAttributes);
  const orgsToSearch = filterCQOrgsToSearch(allOrgsWithBasics);
  const [xcpdGatewaysWithoutGirthEnabled, xcpdGatewaysWithGirthEnabled] =
    await cqOrgsToXCPDGateways(orgsToSearch);

  return {
    organization,
    xcpdGatewaysWithoutGirthEnabled,
    xcpdGatewaysWithGirthEnabled,
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
