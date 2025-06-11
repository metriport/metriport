import { errorToString, executeWithNetworkRetries, MetriportError } from "@metriport/shared";
import { logAxiosResponse } from "@metriport/shared/common/response";
import axios from "axios";
import { Config } from "../../../../util/config";
import { out } from "../../../../util/log";
import { JobBaseParams } from "./shared";

export type RunJobParams = JobBaseParams & {
  jobType: string;
  payload: Record<string, unknown>;
};

/**
 * Sends a request to the API to complete the job.
 *
 * @param jobId - The job ID.
 * @param cxId - The CX ID.
 * @param jobType - The job type.
 * @param payload - The payload to send with the request.
 */
export async function runJob({ jobId, cxId, jobType, payload }: RunJobParams): Promise<void> {
  const { log, debug } = out(`completeJob - jobId ${jobId} cxId ${cxId} jobType ${jobType}`);
  const api = axios.create({ baseURL: Config.getApiUrl() });
  const queryParams = new URLSearchParams({ cxId });
  const runJobUrl = `/internal/patient/job/${jobType}/${jobId}/run?${queryParams.toString()}`;
  try {
    const response = await executeWithNetworkRetries(async () => {
      return api.post(runJobUrl, payload);
    });
    logAxiosResponse(runJobUrl, response, debug);
  } catch (error) {
    const msg = "Failure while running job @ Api";
    log(`${msg}. Cause: ${errorToString(error)}`);
    throw new MetriportError(msg, error, {
      cxId,
      jobId,
      url: runJobUrl,
      context: "ehr.runJob",
    });
  }
}
