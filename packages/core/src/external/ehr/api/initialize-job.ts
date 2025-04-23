import { errorToString, MetriportError } from "@metriport/shared";
import axios from "axios";
import { Config } from "../../../util/config";
import { out } from "../../../util/log";
import { ApiBaseParams } from "./api-shared";

export type InitializeJobParams = Pick<ApiBaseParams, "cxId"> & {
  jobId: string;
};

/**
 * Sends a request to the API to initialize the job.
 * @param jobId - The job ID.
 * @param cxId - The CX ID.
 */
export async function initializeJob({ jobId, cxId }: InitializeJobParams): Promise<void> {
  const { log, debug } = out(`Ehr initializeJob - jobId ${jobId} cxId ${cxId}`);
  const api = axios.create({ baseURL: Config.getApiUrl() });
  const queryParams = new URLSearchParams({ cxId });
  const initializeJobUrl = `/internal/job/patient/initialize/${jobId}?${queryParams.toString()}`;
  try {
    const response = await api.post(initializeJobUrl);
    if (!response.data) throw new Error(`No body returned from ${initializeJobUrl}`);
    debug(`${initializeJobUrl} resp: ${JSON.stringify(response.data)}`);
    return response.data;
  } catch (error) {
    const msg = "Failure while initializing job @ Api";
    log(`${msg}. Cause: ${errorToString(error)}`);
    throw new MetriportError(msg, error, {
      cxId,
      jobId,
      url: initializeJobUrl,
      context: "ehr.initializeJob",
    });
  }
}
