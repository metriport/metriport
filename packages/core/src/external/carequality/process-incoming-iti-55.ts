import { AxiosResponse } from "axios";
import {
  PatientDiscoveryRequestIncoming,
  PatientDiscoveryResponseOutgoing,
} from "@metriport/ihe-gateway-sdk";
import { PatientDataMPI, convertPatientToFHIR } from "../mpi/patient-incoming-schema";
import {
  validateFHIRAndExtractPatient,
  InternalError,
  PatientAddressRequestedError,
  LivingSubjectAdministrativeGenderRequestedError,
} from "../carequality/validating-iti55";
import { matchPatients, jaroWinklerSimilarity } from "../mpi/match-patients";
import { normalizePatientDataMPI } from "../mpi/normalize-patient";
import { mergePatients, mergeWithFirstPatient } from "../mpi/merge-patients";
import { capture } from "../../util/notifications";
import { getEnvVarOrFail } from "../../util/env-var";

import axios from "axios";
const ossApi = axios.create();
const SIMILARITY_THRESHOLD = 0.96;
const METRIPORT_HOME_COMMUNITY_ID = "urn:oid:2.16.840.1.113883.3.9621";

type MPIBlockParams = {
  dob: string;
  genderAtBirth: string;
  firstNameInitial?: string;
  lastNameInitial?: string;
};

function constructInternalErrorResponse(
  payload: PatientDiscoveryRequestIncoming,
  error: string
): PatientDiscoveryResponseOutgoing {
  return {
    id: payload.id,
    timestamp: payload.timestamp,
    responseTimestamp: new Date().toISOString(),
    patientMatch: false,
    xcpdHomeCommunityId: payload.samlAttributes.homeCommunityId,
    operationOutcome: {
      resourceType: "OperationOutcome",
      id: payload.id,
      issue: [
        {
          severity: "error",
          code: "processing",
          details: {
            coding: [{ system: "1.3.6.1.4.1.19376.1.2.27.3", code: "InternalError" }],
            text: error,
          },
        },
      ],
    },
  };
}

export async function processIncomingRequest(
  payload: PatientDiscoveryRequestIncoming
): Promise<PatientDiscoveryResponseOutgoing> {
  const apiClient = apiClientMPIBlockEndpoint();
  console.log("payload", payload);

  let patient: PatientDataMPI;
  try {
    patient = validateFHIRAndExtractPatient(payload.patientResource);
    console.log("patient", patient);
  } catch (error) {
    if (error instanceof InternalError) {
      return constructInternalErrorResponse(payload, error.message);
    } else if (error instanceof PatientAddressRequestedError) {
      return constructInternalErrorResponse(payload, error.message);
    } else if (error instanceof LivingSubjectAdministrativeGenderRequestedError) {
      return constructInternalErrorResponse(payload, error.message);
    } else {
      return constructInternalErrorResponse(payload, "Internal Server Error");
    }
  }

  const normalizedPatientDemo = normalizePatientDataMPI(patient);
  if (!normalizedPatientDemo) {
    throw new Error("Invalid patient data");
  }
  console.log("normalizedPatientDemo", normalizedPatientDemo);

  const response = await apiClient.callInternalEndpoint({
    dob: normalizedPatientDemo.dob,
    genderAtBirth: normalizedPatientDemo.genderAtBirth,
  });
  const blockedPatients: PatientDataMPI[] = response.data;
  console.log("blockedPatients", blockedPatients);

  const matchingPatients = matchPatients(
    jaroWinklerSimilarity,
    blockedPatients,
    normalizedPatientDemo,
    SIMILARITY_THRESHOLD
  );
  console.log("matchingPatients", matchingPatients);

  const mpiPatient = await mergePatients(
    mergeWithFirstPatient,
    matchingPatients,
    normalizedPatientDemo
  );
  console.log("mpiPatient", mpiPatient);

  if (!mpiPatient) throw Error("No patient found");
  return {
    id: payload.id,
    timestamp: payload.timestamp,
    responseTimestamp: new Date().toISOString(),
    patientMatch: true,
    xcpdPatientId: {
      id: mpiPatient.id,
      system: "000",
    },
    patientResource: convertPatientToFHIR(mpiPatient),
    xcpdHomeCommunityId: METRIPORT_HOME_COMMUNITY_ID,
  };
}

export function apiClientMPIBlockEndpoint() {
  const apiURL = getEnvVarOrFail("API_URL");
  const postEndpointUrl = `${apiURL}/internal/patient/mpi/block`;
  console.log("postEndpointUrl", postEndpointUrl);

  return {
    callInternalEndpoint: async function (
      params: MPIBlockParams
    ): Promise<AxiosResponse<PatientDataMPI[]>> {
      try {
        return await ossApi.post(postEndpointUrl, params, {
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
    },
  };
}
