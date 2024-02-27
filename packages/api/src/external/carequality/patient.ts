import { Patient, PatientExternalData } from "@metriport/core/domain/patient";
import { toFHIR } from "@metriport/core/external/fhir/patient/index";
import { MedicalDataSource } from "@metriport/core/external/index";
import { out } from "@metriport/core/util/log";
import { capture } from "@metriport/core/util/notifications";
import {
  checkIfRaceIsComplete,
  controlDuration,
  RaceControl,
} from "@metriport/core/util/race-control";
import { OutboundPatientDiscoveryReq } from "@metriport/ihe-gateway-sdk";
import { errorToString } from "@metriport/shared/common/error";
import dayjs from "dayjs";
import duration from "dayjs/plugin/duration";
import { getOrganizationOrFail } from "../../command/medical/organization/get-organization";
import { Product } from "../../domain/product";
import { analytics, EventTypes } from "../../shared/analytics";
import { isCQDirectEnabledForCx } from "../aws/appConfig";
import { makeIheGatewayAPIForPatientDiscovery } from "../ihe-gateway/api";
import { getCQGateways } from "./command/cq-directory/cq-gateways";
import {
  filterCQOrgsToSearch,
  searchCQDirectoriesAroundPatientAddresses,
  toBasicOrgAttributes,
} from "./command/cq-directory/search-cq-directory";
import { createOrUpdateCQPatientData } from "./command/cq-patient-data/create-cq-data";
import { deleteCQPatientData } from "./command/cq-patient-data/delete-cq-data";
import {
  getOutboundPatientDiscoveryRespCount,
  getOutboundPatientDiscoveryResps,
} from "./command/outbound-patient-discovery-resp/get-outbound-patient-discovery-resp";
import { CQLink } from "./cq-patient-data";
import { createPatientDiscoveryRequest } from "./create-pd-request";
import { cqOrgsToXCPDGateways, generateIdsForGateways } from "./organization-conversion";
import { OutboundPatientDiscoveryResp } from "./patient-discovery-result";
import { PatientDataCarequality } from "./patient-shared";

dayjs.extend(duration);

const context = "cq.patient.discover";
const iheGateway = makeIheGatewayAPIForPatientDiscovery();

export const PATIENT_DISCOVERY_TIMEOUT = dayjs.duration({ seconds: 15 });
const CHECK_DB_INTERVAL = dayjs.duration({ seconds: 5 });

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
    await iheGateway.startPatientDiscovery(pdRequest);

    const raceControl: RaceControl = { isRaceInProgress: true };
    // Run the patient discovery until it either times out, or all the results are in the database
    const raceResult = await Promise.race([
      controlDuration(
        PATIENT_DISCOVERY_TIMEOUT.asMilliseconds(),
        `Patient discovery reached timeout after ${PATIENT_DISCOVERY_TIMEOUT.asMilliseconds()} ms`
      ),
      checkIfRaceIsComplete(
        () => isPDComplete(pdRequest.id, numGateways),
        raceControl,
        `Patient discovery results came back in full (${pdRequest.gateways.length} gateways)`,
        CHECK_DB_INTERVAL.asMilliseconds()
      ),
    ]);
    const pdResults = await getOutboundPatientDiscoveryResps(pdRequest.id, "success");
    if (raceResult) {
      log(`${raceResult}. Got ${pdResults.length} successes out of ${numGateways} gateways for PD`);
      raceControl.isRaceInProgress = false;
    }
    analytics({
      distinctId: cxId,
      event: EventTypes.patientDiscovery,
      properties: {
        numberGateways: numGateways,
        numberLinkedGateways: pdResults.length,
      },
      apiType: Product.medical,
    });

    if (pdResults.length === 0) {
      log(`No patient discovery results found.`);
      return;
    }
    log(`Starting to handle patient discovery results`);
    await handlePatientDiscoveryResults(patient, pdResults);

    log(`Completed.`);
  } catch (error) {
    const msg = `Error on Patient Discovery`;
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

  const pdRequest = createPatientDiscoveryRequest({
    patient: fhirPatient,
    cxId: patient.cxId,
    xcpdGateways,
    facilityNPI,
    orgName: organization.data.name,
    orgOid: organization.oid,
  });
  return pdRequest;
}

async function handlePatientDiscoveryResults(
  patient: Patient,
  pdResults: OutboundPatientDiscoveryResp[]
): Promise<void> {
  const { id, cxId } = patient;
  const cqLinks = buildCQLinks(pdResults);
  if (cqLinks.length) await createOrUpdateCQPatientData({ id, cxId, cqLinks });
}

function buildCQLinks(pdResults: OutboundPatientDiscoveryResp[]): CQLink[] {
  return pdResults.flatMap(pd => {
    const id = pd.data.externalGatewayPatient?.id;
    const system = pd.data.externalGatewayPatient?.system;
    const url = pd.data.gateway.url;
    if (!id || !system || !url) return [];
    return {
      patientId: id,
      systemId: system,
      oid: pd.data.gateway.oid,
      url,
      id: pd.data.gateway.id,
    };
  });
}

async function isPDComplete(requestId: string, numGatewaysInRequest: number): Promise<boolean> {
  const pdResultCount = await getOutboundPatientDiscoveryRespCount(requestId);
  return pdResultCount >= numGatewaysInRequest;
}
