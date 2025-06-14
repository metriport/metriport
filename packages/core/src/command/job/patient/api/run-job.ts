import { errorToString, executeWithNetworkRetries, MetriportError } from "@metriport/shared";
import { logAxiosResponse } from "@metriport/shared/common/response";
import axios from "axios";
import { Config } from "../../../../util/config";
import { out } from "../../../../util/log";
import { JobBaseParams } from "./shared";

export type RunJobParams = JobBaseParams & {
  jobType: string;
};

/**
 * Sends a request to the API to run the job.
 *
 * @param jobId - The job ID.
 * @param cxId - The CX ID.
 * @param jobType - The job type.
 */
export async function runJob({ jobId, cxId, jobType }: RunJobParams): Promise<void> {
  const { log, debug } = out(`runJob - jobId ${jobId} cxId ${cxId} jobType ${jobType}`);
  const api = axios.create({ baseURL: Config.getApiUrl() });
  const queryParams = new URLSearchParams({ cxId });
  const runJobUrl = `/internal/patient/job/${jobType}/${jobId}/run?${queryParams.toString()}`;
  try {
    const response = await executeWithNetworkRetries(async () => {
      return api.post(runJobUrl);
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
