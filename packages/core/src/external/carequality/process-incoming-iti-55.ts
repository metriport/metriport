import { AxiosResponse } from "axios";
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
  console.log("payload", payload);

  const patient = convertFHIRToPatient(payload.patientResource);
  console.log("patient", patient);

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
