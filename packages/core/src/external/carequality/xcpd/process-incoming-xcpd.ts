import { AxiosResponse } from "axios";
import {
  PatientDiscoveryRequestIncoming,
  PatientDiscoveryResponseOutgoing,
} from "@metriport/ihe-gateway-sdk";
import { PatientDataMPI, convertPatientToFHIR } from "../../mpi/patient";
import {
  validateFHIRAndExtractPatient,
  InternalError,
  PatientAddressRequestedError,
  LivingSubjectAdministrativeGenderRequestedError,
} from "./validating-xcpd";
import {
  matchPatients,
  jaroWinklerSimilarity,
  matchingPersonalIdentifiersRule,
} from "../../mpi/match-patients";
import { normalizePatientDataMPI } from "../../mpi/normalize-patient";
import { mergePatients, mergeWithFirstPatient } from "../../mpi/merge-patients";
import { capture } from "../../../util/notifications";
import { getEnvVarOrFail } from "../../../util/env-var";
import axios from "axios";

const ossApi = axios.create();
const SIMILARITY_THRESHOLD = 0.96;
const METRIPORT_HOME_COMMUNITY_ID = "urn:oid:2.16.840.1.113883.3.9621";
const apiURL = getEnvVarOrFail("API_URL");
const postEndpointUrl = `${apiURL}/internal/patient/mpi/block`;

type MPIBlockParams = {
  dob: string;
  genderAtBirth: string;
  firstNameInitial?: string;
  lastNameInitial?: string;
};

function constructErrorResponse(
  payload: PatientDiscoveryRequestIncoming,
  codingSystem: string,
  code: string,
  error: string
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
            coding: [{ system: codingSystem, code: code }],
            text: error,
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
  patient: PatientDataMPI
): PatientDiscoveryResponseOutgoing {
  return {
    id: payload.id,
    timestamp: payload.timestamp,
    responseTimestamp: new Date().toISOString(),
    patientMatch: true,
    xcpdPatientId: {
      id: patient.id,
      system: "000", // TBD	- what is this
    },
    patientResource: convertPatientToFHIR(patient),
    xcpdHomeCommunityId: METRIPORT_HOME_COMMUNITY_ID,
  };
}

export async function processIncomingRequest(
  payload: PatientDiscoveryRequestIncoming
): Promise<PatientDiscoveryResponseOutgoing> {
  try {
    const patient = validateFHIRAndExtractPatient(payload.patientResource);
    const normalizedPatientDemo = normalizePatientDataMPI(patient);

    if (!normalizedPatientDemo) {
      return constructErrorResponse(
        payload,
        "1.3.6.1.4.1.19376.1.2.27.3",
        "Internal Server Error",
        "Invalid Patient Data"
      );
    }

    const response = await callMPIBlockEndpoint({
      dob: normalizedPatientDemo.dob,
      genderAtBirth: normalizedPatientDemo.genderAtBirth,
    });

    const blockedPatients: PatientDataMPI[] = response.data;

    const matchingPatients = matchPatients(
      jaroWinklerSimilarity,
      [matchingPersonalIdentifiersRule],
      blockedPatients,
      normalizedPatientDemo,
      SIMILARITY_THRESHOLD
    );

    const mpiPatient = mergePatients(
      mergeWithFirstPatient,
      matchingPatients,
      normalizedPatientDemo
    );

    if (!mpiPatient) {
      return constructNoMatchResponse(payload);
    }
    return constructMatchResponse(payload, mpiPatient);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } catch (error: any) {
    switch (error.constructor) {
      case InternalError:
        return constructErrorResponse(
          payload,
          "1.3.6.1.4.1.19376.1.2.27.3",
          "InternalError",
          error.message
        );
      case PatientAddressRequestedError:
        return constructErrorResponse(
          payload,
          "1.3.6.1.4.1.19376.1.2.27.1",
          "PatientAddressRequested",
          error.message
        );
      case LivingSubjectAdministrativeGenderRequestedError:
        return constructErrorResponse(
          payload,
          "1.3.6.1.4.1.19376.1.2.27.1",
          "LivingSubjectAdministrativeGenderRequested",
          error.message
        );
      default:
        return constructErrorResponse(
          payload,
          "1.3.6.1.4.1.19376.1.2.27.3",
          "Internal Server Error",
          "Unknown Error: Contact Metriport Support for assistance"
        );
    }
  }
}

export async function callMPIBlockEndpoint(
  params: MPIBlockParams
): Promise<AxiosResponse<PatientDataMPI[]>> {
  try {
    return await ossApi.post(postEndpointUrl, null, {
      params: {
        dob: params.dob,
        genderAtBirth: params.genderAtBirth,
        firstNameInitial: params.firstNameInitial,
        lastNameInitial: params.lastNameInitial,
      },
    });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } catch (error: any) {
    const msg = "Error notifying MPI Blocking Internal API";
    const extra = {
      url: postEndpointUrl,
      statusCode: error.response?.status,
      error,
    };
    console.log(msg, extra);
    capture.message(msg, { extra, level: "info" });
    throw new Error(`Error from API: ${error.message}`);
  }
}
