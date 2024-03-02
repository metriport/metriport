import { Patient, PatientExternalData } from "@metriport/core/domain/patient";
import { toFHIR } from "@metriport/core/external/fhir/patient/index";
import { MedicalDataSource } from "@metriport/core/external/index";
import { out } from "@metriport/core/util/log";
import { capture } from "@metriport/core/util/notifications";
import { OutboundPatientDiscoveryReq } from "@metriport/ihe-gateway-sdk";
import { errorToString } from "@metriport/shared/common/error";
import dayjs from "dayjs";
import duration from "dayjs/plugin/duration";
import { getOrganizationOrFail } from "../../command/medical/organization/get-organization";
import { isCQDirectEnabledForCx } from "../aws/appConfig";
import { makeIheGatewayAPIForPatientDiscovery } from "../ihe-gateway/api";
import { getCQGateways } from "./command/cq-directory/cq-gateways";
import {
  filterCQOrgsToSearch,
  searchCQDirectoriesAroundPatientAddresses,
  toBasicOrgAttributes,
} from "./command/cq-directory/search-cq-directory";
import { deleteCQPatientData } from "./command/cq-patient-data/delete-cq-data";
import { createOutboundPatientDiscoveryReq } from "./create-outbound-patient-discovery-req";
import { cqOrgsToXCPDGateways, generateIdsForGateways } from "./organization-conversion";
import { PatientDataCarequality } from "./patient-shared";
import { makeOutboundResultPoller } from "../ihe-gateway/outbound-result-poller-factory";
import { updatePatientDiscoveryStatus } from "./command/update-patient-discovery-status";

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
    await updatePatientDiscoveryStatus({ patient, status: "processing" });
    await iheGateway.startPatientDiscovery(pdRequest);

    await resultPoller.pollOutboundPatientDiscoveryResults({
      requestId: pdRequest.id,
      patientId: patient.id,
      cxId: patient.cxId,
      numOfGateways: numGateways,
    });
  } catch (error) {
    const msg = `Error on Patient Discovery`;
    await updatePatientDiscoveryStatus({ patient, status: "failed" });
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
  const { cxId } = patient;
  const fhirPatient = toFHIR(patient);
  const [organization, nearbyCQOrgs, cqGateways] = await Promise.all([
    getOrganizationOrFail({ cxId }),
    searchCQDirectoriesAroundPatientAddresses({ patient }),
    getCQGateways(),
  ]);

  const cqGatewaysBasicDetails = cqGateways.map(toBasicOrgAttributes);
  const orgsToSearch = filterCQOrgsToSearch([...cqGatewaysBasicDetails, ...nearbyCQOrgs]);
  const xcpdGatewaysWithoutIds = cqOrgsToXCPDGateways(orgsToSearch);
  const xcpdGateways = generateIdsForGateways(xcpdGatewaysWithoutIds);

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
