import {
  PatientDiscoveryRequestIncoming,
  PatientDiscoveryResponseOutgoing,
} from "@metriport/ihe-gateway-sdk";
import { Patient } from "../../../domain/medical/patient";
import { MPI } from "../../../mpi/mpi";
import { patientMPIToPartialPatient } from "../../../mpi/shared";
import { toFHIR as convertPatientToFHIR } from "../../fhir/patient";
import { validateFHIRAndExtractPatient } from "./validating-pd";
import {
  InternalError,
  LivingSubjectAdministrativeGenderRequestedError,
  PatientAddressRequestedError,
} from "../error";

import {
  METRIPORT_HOME_COMMUNITY_ID,
  CODE_SYSTEM_REQUESTED_ERROR as PD_CODE_SYSTEM_REQUESTED_ERROR,
  CODE_SYSTEM_REQUIRED_ERROR as PD_CODE_SYSTEM_REQUIRED_ERROR,
} from "../shared";

import { constructPDNoMatchResponse, constructPDErrorResponse } from "../error";

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
  // workaround to allow injecting the behavior since this is an isolated function, not a class
  mpi: MPI
): Promise<PatientDiscoveryResponseOutgoing> {
  try {
    const patient = validateFHIRAndExtractPatient(payload);
    const matchingPatient = await mpi.findMatchingPatient(patient);
    if (!matchingPatient) {
      return constructPDNoMatchResponse(payload);
    }
    return constructMatchResponse(payload, patientMPIToPartialPatient(matchingPatient));
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } catch (error: any) {
    switch (error.constructor) {
      case InternalError:
        return constructPDErrorResponse(
          payload,
          PD_CODE_SYSTEM_REQUIRED_ERROR,
          "InternalError",
          error.message
        );
      case PatientAddressRequestedError:
        return constructPDErrorResponse(
          payload,
          PD_CODE_SYSTEM_REQUESTED_ERROR,
          "PatientAddressRequested",
          error.message
        );
      case LivingSubjectAdministrativeGenderRequestedError:
        return constructPDErrorResponse(
          payload,
          PD_CODE_SYSTEM_REQUESTED_ERROR,
          "LivingSubjectAdministrativeGenderRequested",
          error.message
        );
      default:
        return constructPDErrorResponse(
          payload,
          PD_CODE_SYSTEM_REQUIRED_ERROR,
          "Internal Server Error",
          "Unknown Error: Contact Metriport Support for assistance"
        );
    }
  }
}
