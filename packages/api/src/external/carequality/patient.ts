import { Patient, PatientExternalData } from "@metriport/core/domain/patient";
import { IHEGateway } from "@metriport/ihe-gateway-sdk";
import { Organization } from "@metriport/core/domain/organization";
import { toFHIR } from "@metriport/core/external/fhir/patient/index";
import { MedicalDataSource } from "@metriport/core/external/index";
import { out } from "@metriport/core/util/log";
import { capture } from "@metriport/core/util/notifications";
import { OutboundPatientDiscoveryReq, XCPDGateways } from "@metriport/ihe-gateway-sdk";
import { errorToString } from "@metriport/shared/common/error";
import dayjs from "dayjs";
import duration from "dayjs/plugin/duration";
import { getOrganizationOrFail } from "../../command/medical/organization/get-organization";
import { isCQDirectEnabledForCx } from "../aws/appConfig";
import { makeIheGatewayAPIForPatientDiscovery } from "../ihe-gateway/api";
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
import { cqOrgsToXCPDGateways, generateIdsForGateways } from "./organization-conversion";
import { PatientDataCarequality } from "./patient-shared";

dayjs.extend(duration);

const context = "cq.patient.discover";
const iheGateway = makeIheGatewayAPIForPatientDiscovery();
const resultPoller = makeOutboundResultPoller();

export async function discover(patient: Patient, facilityNPI: string): Promise<void> {
  const baseLogMessage = `CQ PD - patientId ${patient.id}`;
  const { log: outerLog } = out(baseLogMessage);
  const { cxId } = patient;

  if (!iheGateway) return outerLog(`IHE GW not available, skipping PD`);
  if (!(await isCQDirectEnabledForCx(cxId))) {
    return outerLog(`CQ disabled for cx ${cxId}, skipping PD`);
  }

  try {
    const pdRequest = await prepareForPatientDiscovery(patient, facilityNPI);
    const numGateways = pdRequest.gateways.length;

    const { log } = out(`${baseLogMessage}, requestId: ${pdRequest.id}`);

    log(`Kicking off patient discovery`);
    // TODO: ADD THIS BACK IN WHEN CODE IS SYNCHRONOUS
    // await processPatientDiscoveryProgress({ patient, status: "processing" });
    await iheGateway.startPatientDiscovery(pdRequest);

    await resultPoller.pollOutboundPatientDiscoveryResults({
      requestId: pdRequest.id,
      patientId: patient.id,
      cxId: patient.cxId,
      numOfGateways: numGateways,
    });
  } catch (error) {
    const msg = `Error on Patient Discovery`;
    await processPatientDiscoveryProgress({ patient, status: "failed" });
    outerLog(`${msg} - ${errorToString(error)}`);
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

// TODO: REMOVE THIS WHEN CODE IS SYNCHRONOUS
export async function shouldRunDiscovery(
  cxId: string,
  iheGateway: IHEGateway | undefined,
  outerLog: typeof console.log
): Promise<boolean> {
  if (!iheGateway) {
    outerLog(`IHE GW not available, skipping PD`);
    return false;
  }
  if (!(await isCQDirectEnabledForCx(cxId))) {
    outerLog(`CQ disabled for cx ${cxId}, skipping PD`);
    return false;
  }

  return true;
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

async function prepareForPatientDiscovery(
  patient: Patient,
  facilityNPI: string
): Promise<OutboundPatientDiscoveryReq> {
  const fhirPatient = toFHIR(patient);

  const { organization, xcpdGateways } = await gatherXCPDGateways(patient);

  const pdRequest = createOutboundPatientDiscoveryReq({
    patient: fhirPatient,
    cxId: patient.cxId,
    xcpdGateways,
    facilityNPI,
    orgName: organization.data.name,
    orgOid: organization.oid,
  });
  return pdRequest;
}

export async function gatherXCPDGateways(patient: Patient): Promise<{
  organization: Organization;
  xcpdGateways: XCPDGateways;
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
  const xcpdGatewaysWithoutIds = cqOrgsToXCPDGateways(orgsToSearch);
  const xcpdGateways = generateIdsForGateways(xcpdGatewaysWithoutIds);

  return {
    organization,
    xcpdGateways,
  };
}
