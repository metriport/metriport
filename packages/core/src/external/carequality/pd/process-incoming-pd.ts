import {
  PatientDiscoveryRequestIncoming,
  PatientDiscoveryResponseOutgoing,
} from "@metriport/ihe-gateway-sdk";
import { Patient } from "../../../domain/patient";
import { MPI } from "../../../mpi/mpi";
import { patientMPIToPartialPatient } from "../../../mpi/shared";
import { toFHIR as convertPatientToFHIR } from "../../fhir/patient";
import {
  XDSRegistryError,
  LivingSubjectAdministrativeGenderRequestedError,
  PatientAddressRequestedError,
  validateFHIRAndExtractPatient,
  IHEGatewayError,
} from "./validating-pd";

const METRIPORT_HOME_COMMUNITY_ID = "urn:oid:2.16.840.1.113883.3.9621";

function constructErrorResponse(
  payload: PatientDiscoveryRequestIncoming,
  error: IHEGatewayError
): PatientDiscoveryResponseOutgoing {
  return {
    id: payload.id,
    timestamp: payload.timestamp,
    responseTimestamp: new Date().toISOString(),
    patientMatch: null,
    xcpdHomeCommunityId: METRIPORT_HOME_COMMUNITY_ID,
    operationOutcome: {
      resourceType: "OperationOutcome",
      id: payload.id,
      issue: [
        {
          severity: "error",
          code: "processing",
          details: {
            coding: [{ system: error.name, code: error.iheErrorCode }],
            text: error.message,
          },
        },
      ],
    },
  };
}

function constructNoMatchResponse(
  payload: PatientDiscoveryRequestIncoming
): PatientDiscoveryResponseOutgoing {
  return {
    id: payload.id,
    timestamp: payload.timestamp,
    responseTimestamp: new Date().toISOString(),
    patientMatch: false,
    xcpdHomeCommunityId: METRIPORT_HOME_COMMUNITY_ID,
    operationOutcome: {
      resourceType: "OperationOutcome",
      id: payload.id,
      issue: [
        {
          severity: "error",
          code: "processing",
          details: {
            text: "no match found",
          },
        },
      ],
    },
  };
}

function constructMatchResponse(
  payload: PatientDiscoveryRequestIncoming,
  patient: Pick<Patient, "id" | "data">
): PatientDiscoveryResponseOutgoing {
  return {
    id: payload.id,
    timestamp: payload.timestamp,
    responseTimestamp: new Date().toISOString(),
    patientMatch: true,
    externalGatewayPatient: {
      id: patient.id,
      system: "000", // TBD	- what is this
    },
    patientResource: convertPatientToFHIR(patient),
    xcpdHomeCommunityId: METRIPORT_HOME_COMMUNITY_ID,
  };
}

export async function processIncomingRequest(
  payload: PatientDiscoveryRequestIncoming,
  mpi: MPI
): Promise<PatientDiscoveryResponseOutgoing> {
  try {
    const patient = validateFHIRAndExtractPatient(payload.patientResource);
    const matchingPatient = await mpi.findMatchingPatient(patient);
    if (!matchingPatient) {
      return constructNoMatchResponse(payload);
    }
    return constructMatchResponse(payload, patientMPIToPartialPatient(matchingPatient));
  } catch (error) {
    if (error instanceof XDSRegistryError) {
      return constructErrorResponse(payload, error);
    } else if (error instanceof PatientAddressRequestedError) {
      return constructErrorResponse(payload, error);
    } else if (error instanceof LivingSubjectAdministrativeGenderRequestedError) {
      return constructErrorResponse(payload, error);
    } else {
      return constructErrorResponse(payload, new XDSRegistryError());
    }
  }
}
