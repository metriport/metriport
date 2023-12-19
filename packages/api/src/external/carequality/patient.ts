import dayjs from "dayjs";
import duration from "dayjs/plugin/duration";
import { searchNearbyCQOrganizations } from "../../command/medical/cq-directory/search-cq-directory";
import { createOrUpdatePatientCQData } from "../../command/medical/cq-patient-data/create-cq-data";
import {
  getPatientDiscoveryResultCount,
  getPatientDiscoveryResults,
} from "../../command/medical/patient-discovery-result/get-patient-discovery-result";
import { CQLink, PatientCQDataCreate } from "../../domain/medical/cq-patient-data";
import { Organization } from "../../domain/medical/organization";
import { Patient } from "../../domain/medical/patient";
import { PatientDiscoveryResult } from "../../domain/medical/patient-discovery-result";
import { Product } from "../../domain/product";
import { EventTypes, analytics } from "../../shared/analytics";
import { capture } from "../../shared/notifications";
import { toFHIR } from "../fhir/patient";
import { cqOrgsToXCPDGateways } from "./organization-conversion";
import { createPatientDiscoveryRequest } from "./create-pd-request";
import { makeIheGatewayAPI } from "./api";

dayjs.extend(duration);

const createContext = "cq.patient.discover";
export const PATIENT_DISCOVERY_TIMEOUT = dayjs.duration({ minutes: 2 });
const CHECK_DB_INTERVAL = dayjs.duration({ seconds: 5 });
type RaceControl = { isRaceInProgress: boolean };

export async function discover(
  patient: Patient,
  organization: Organization,
  facilityNPI: string
): Promise<void> {
  try {
    const { id, cxId } = patient;
    const iheGateway = makeIheGatewayAPI();
    console.log(`Kicking off patient discovery for patientId: ${id}`);

    const fhirPatient = toFHIR(patient);

    const nearbyCQOrgs = await searchNearbyCQOrganizations({
      cxId,
      patientId: id,
    });
    const xcpdGateways = cqOrgsToXCPDGateways(nearbyCQOrgs);

    const pdRequest = createPatientDiscoveryRequest({
      patient: fhirPatient,
      cxId: patient.cxId,
      xcpdGateways,
      facilityNPI,
      orgName: organization.data.name,
      orgOid: organization.oid,
    });

    // Intentionally asynchronous - we will be checking for the results in the database
    iheGateway.startPatientDiscovery([pdRequest]);

    const raceControl: RaceControl = { isRaceInProgress: true };
    // Run the patient discovery until it either times out, or all the results are in the database
    const raceResult = await Promise.race([
      startTimeout(),
      checkNumberOfResults(raceControl, pdRequest.id, pdRequest.xcpdGateways.length), // TODO: RAISE A FOLLOW UP - set up an event listener for Mirth
    ]);
    if (raceResult) {
      console.log(`${raceResult}. Starting to handle patient discovery results. PatientId: ${id}`);
      raceControl.isRaceInProgress = false;
    }

    // At this point, discovery results are stored in the database, so we can retrieve them
    const discoveryResults = await getPatientDiscoveryResults(pdRequest.id);
    await handlePatientDiscoveryResults(patient, discoveryResults);

    analytics({
      distinctId: cxId,
      event: EventTypes.patientDiscovery,
      properties: {
        apiType: Product.medical,
        numberGateways: xcpdGateways.length,
        numberLinkedGateways: discoveryResults.length,
      },
    });
  } catch (err) {
    const msg = `Failed to carry out patient discovery for ${patient.id}`;
    console.error(msg, err);
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

export async function handlePatientDiscoveryResults(
  patient: Patient,
  pdResults: PatientDiscoveryResult[]
): Promise<void> {
  if (pdResults.length === 0) {
    console.log(`No patient discovery results found for patientId: ${patient.id}`);
    return;
  }
  const { id, cxId } = patient;

  const cqLinks = buildCQLinks(pdResults);
  const pdCreate: PatientCQDataCreate = {
    id,
    cxId,
    data: { links: cqLinks },
  };

  if (cqLinks.length) await createOrUpdatePatientCQData(pdCreate);
}

export function buildCQLinks(pdResults: PatientDiscoveryResult[]): CQLink[] {
  return pdResults.flatMap(pd => {
    const id = pd.data.xcpdPatientId?.id;
    const system = pd.data.xcpdPatientId?.system;
    if (!id || !system) return [];
    return {
      patientId: id,
      systemId: system,
      ...pd.data.gateway,
    };
  });
}

function startTimeout() {
  const timeout = PATIENT_DISCOVERY_TIMEOUT.asMilliseconds();
  return new Promise<string>(resolve => {
    setTimeout(() => {
      const msg = `Patient discovery reached timeout after ${timeout} ms`;
      resolve(msg);
    }, timeout);
  });
}

function checkNumberOfResults(
  raceControl: RaceControl,
  requestId: string,
  numberOfGateways: number
): Promise<string> {
  return new Promise(resolve => {
    const checkAndResolve = () => {
      isPDComplete(requestId, numberOfGateways).then(isComplete => {
        if (isComplete) {
          const msg = `Patient discovery results came back in full (${numberOfGateways} gateways)`;
          resolve(msg);
          raceControl.isRaceInProgress = false;
        } else {
          setTimeout(checkAndResolve, CHECK_DB_INTERVAL.asMilliseconds());
        }
      });
    };

    checkAndResolve();
  });
}

async function isPDComplete(requestId: string, numGatewaysInRequest: number) {
  const pdResultCount = await getPatientDiscoveryResultCount(requestId);
  return pdResultCount === numGatewaysInRequest;
}
