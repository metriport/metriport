import { OutboundPatientDiscoveryReq } from "@metriport/ihe-gateway-sdk";
import {
  RaceControl,
  checkIfRaceIsComplete,
  controlDuration,
} from "@metriport/core/util/race-control";
import dayjs from "dayjs";
import duration from "dayjs/plugin/duration";
import { getOrganizationOrFail } from "../../command/medical/organization/get-organization";
import { Patient, PatientExternalData } from "@metriport/core/domain/patient";
import { Product } from "../../domain/product";
import { analytics, EventTypes } from "../../shared/analytics";
import { capture } from "../../shared/notifications";
import { Util } from "../../shared/util";
import { toFHIR } from "@metriport/core/external/fhir/patient/index";
import { makeIheGatewayAPI } from "./api";
import {
  searchCQDirectoriesAroundPatientAddresses,
  filterCQOrgsToSearch,
  toBasicOrgAttributes,
} from "./command/cq-directory/search-cq-directory";
import { createOrUpdateCQPatientData } from "./command/cq-patient-data/create-cq-data";
import { deleteCQPatientData } from "./command/cq-patient-data/delete-cq-data";
import {
  getOutboundPatientDiscoveryRespCount,
  getOutboundPatientDiscoveryResps,
} from "./command/outbound-patient-discovery-resp/get-outbound-patient-discovery-resp";
import { createPatientDiscoveryRequest } from "./create-pd-request";
import { CQLink } from "./cq-patient-data";
import { OutboundPatientDiscoveryResp } from "./patient-discovery-result";
import { cqOrgsToXCPDGateways, generateIdsForGateways } from "./organization-conversion";
import { MedicalDataSource } from "@metriport/core/external/index";
import { PatientDataCarequality } from "./patient-shared";
import { getCQGateways } from "./command/cq-directory/cq-gateways";

dayjs.extend(duration);

export function getCQData(
  data: PatientExternalData | undefined
): PatientDataCarequality | undefined {
  if (!data) return undefined;
  return data[MedicalDataSource.CAREQUALITY] as PatientDataCarequality; // TODO validate the type
}

const createContext = "cq.patient.discover";

export const PATIENT_DISCOVERY_TIMEOUT = dayjs.duration({ minutes: 0.25 });
const CHECK_DB_INTERVAL = dayjs.duration({ seconds: 5 });

export async function discover(patient: Patient, facilityNPI: string): Promise<void> {
  const { log } = Util.out(`CQ discover - M patientId ${patient.id}`);
  try {
    const iheGateway = makeIheGatewayAPI();
    if (!iheGateway) return;

    const { cxId } = patient;
    const pdRequest = await prepareForPatientDiscovery(patient, facilityNPI);
    const numGateways = pdRequest.gateways.length;

    log(`Kicking off patient discovery. RequestID: ${pdRequest.id}`);
    // Intentionally asynchronous - we will be checking for the results in the database
    iheGateway.startPatientDiscovery(pdRequest);

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
        `Patient discovery results came back in full (${pdRequest.gateways.length} gateways). RequestID: ${pdRequest.id}`,
        CHECK_DB_INTERVAL.asMilliseconds()
      ),
    ]);
    const pdResults = await getOutboundPatientDiscoveryResps(pdRequest.id, "success");
    if (raceResult) {
      log(
        `${raceResult}. Got ${pdResults.length} successes out of ${numGateways} gateways for PD. RequestID: ${pdRequest.id}`
      );
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
      log(`No patient discovery results found. RequestID: ${pdRequest.id}`);
      return;
    }
    log(`Starting to handle patient discovery results. RequestID: ${pdRequest.id}`);
    await handlePatientDiscoveryResults(patient, pdResults);
  } catch (err) {
    const msg = `Failed to carry out patient discovery - M patient ${patient.id}`;
    log(msg, err);
    capture.message(msg, {
      extra: {
        facilityNPI,
        patientId: patient.id,
        context: createContext,
        error: err,
      },
      level: "error",
    });
  }
}

export async function remove(patient: Patient): Promise<void> {
  console.log(`Deleting CQ data - M patientId ${patient.id}`);
  await deleteCQPatientData({ id: patient.id, cxId: patient.cxId });
}

export async function prepareForPatientDiscovery(
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
  const orgsToSearch = filterCQOrgsToSearch([...nearbyCQOrgs, ...cqGatewaysBasicDetails]);
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

export async function handlePatientDiscoveryResults(
  patient: Patient,
  pdResults: OutboundPatientDiscoveryResp[]
): Promise<void> {
  const { id, cxId } = patient;
  const cqLinks = buildCQLinks(pdResults);
  if (cqLinks.length) await createOrUpdateCQPatientData({ id, cxId, cqLinks });
}

export function buildCQLinks(pdResults: OutboundPatientDiscoveryResp[]): CQLink[] {
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
