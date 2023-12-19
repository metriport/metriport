import {
  PatientDiscoveryRequestIncoming,
  PatientDiscoveryResponseOutgoing,
} from "@metriport/ihe-gateway-sdk";

import {
  PatientDataMPI,
  convertFHIRToPatient,
  convertPatientToFHIR,
} from "../mpi/patient-incoming-schema";
import { matchPatients, jaroWinklerSimilarity } from "../mpi/match-patients";
import { normalizePatientDataMPI } from "../mpi/normalize-patient";
import { mergePatients, mergeWithFirstPatient } from "../mpi/merge-patients";
import { capture } from "../../util/notifications";
import { getEnvVarOrFail } from "../../util/env-var";

import axios from "axios";
const ossApi = axios.create();
const SIMILARITY_THRESHOLD = 0.96;
const METRIPORT_HOME_COMMUNITY_ID = "urn:oid:2.16.840.1.113883.3.9621";

//function timestampVerification(payload: PatientDiscoveryRequestIncoming): void {}
//function samlVerification(payload: PatientDiscoveryRequestIncoming): void {}

type MPIBlockParams = {
  dob: string;
  genderAtBirth: string;
  firstNameInitial?: string;
  lastNameInitial?: string;
};

export async function processRequest(
  payload: PatientDiscoveryRequestIncoming
): Promise<PatientDiscoveryResponseOutgoing> {
  const apiClient = apiClientMPIBlockEndpoint();

  const patient = convertFHIRToPatient(payload.patientResource);

  const normalizedPatientDemo = normalizePatientDataMPI(patient);
  if (!normalizedPatientDemo) {
    throw new Error("Invalid patient data");
  }
  const blockedPatients: PatientDataMPI[] = await apiClient.callInternalEndpoint({
    dob: normalizedPatientDemo.dob,
    genderAtBirth: normalizedPatientDemo.genderAtBirth,
  });

  const matchingPatients = matchPatients(
    jaroWinklerSimilarity,
    blockedPatients,
    normalizedPatientDemo,
    SIMILARITY_THRESHOLD
  );

  const mpiPatient = await mergePatients(
    mergeWithFirstPatient,
    matchingPatients,
    normalizedPatientDemo
  );
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
  const postEndpointUrl = `${apiURL}/mpi/block`;

  return {
    callInternalEndpoint: async function (params: MPIBlockParams): Promise<PatientDataMPI[]> {
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
