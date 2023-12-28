import axios from "axios";
import { capture } from "../../util/notifications";
import { PatientBlocker, PatientBlock } from "./patient-blocker";
import { getEnvVarOrFail } from "../../util/env-var";
import { PatientDataMPI } from "./patient";

const apiURL = getEnvVarOrFail("API_URL");
const postEndpointUrl = `${apiURL}/internal/patient/mpi/block`;

const ossApi = axios.create();

export class CQPatientBlocker extends PatientBlocker {
  async block(params: PatientBlock): Promise<PatientDataMPI[]> {
    const response = await callMPIBlockEndpoint(params);
    return response;
  }
}

async function callMPIBlockEndpoint(params: PatientBlock): Promise<PatientDataMPI[]> {
  try {
    const response = await ossApi.post(postEndpointUrl, null, {
      params: {
        dob: params.data?.dob,
        genderAtBirth: params.data?.genderAtBirth,
        firstNameInitial: params.data?.firstNameInitial,
        lastNameInitial: params.data?.lastNameInitial,
      },
    });
    return response.data;
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
