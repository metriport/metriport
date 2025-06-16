import { errorToString, executeWithNetworkRetries, MetriportError } from "@metriport/shared";
import { logAxiosResponse } from "@metriport/shared/common/response";
import axios from "axios";
import { Config } from "../../../../util/config";
import { out } from "../../../../util/log";
import { JobBaseParams } from "./shared";

export type RunJobParams = JobBaseParams & {
  runUrl: string;
};

/**
 * Sends a request to the API to run the job.
 *
 * @param jobId - The job ID.
 * @param cxId - The CX ID.
 * @param runUrl - The run URL.
 */
export async function runJob({ jobId, cxId, runUrl }: RunJobParams): Promise<void> {
  const { log, debug } = out(`runJob - jobId ${jobId} cxId ${cxId} runUrl ${runUrl}`);
  const api = axios.create({ baseURL: Config.getApiUrl() });
  try {
    const response = await executeWithNetworkRetries(async () => {
      return api.post(runUrl, {
        cxId,
        jobId,
      });
    });
    logAxiosResponse(runUrl, response, debug);
  } catch (error) {
    const msg = "Failure while running job @ Api";
    log(`${msg}. Cause: ${errorToString(error)}`);
    throw new MetriportError(msg, error, {
      cxId,
      jobId,
      url: runUrl,
      context: "ehr.runJob",
    });
  }
}
