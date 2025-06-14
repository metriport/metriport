import { errorToString, executeWithNetworkRetries, MetriportError } from "@metriport/shared";
import { logAxiosResponse } from "@metriport/shared/common/response";
import axios from "axios";
import { Config } from "../../../../util/config";
import { out } from "../../../../util/log";
import { JobBaseParams } from "./shared";

/**
 * Sends a request to the API to initialize the job.
 *
 * @param jobId - The job ID.
 * @param cxId - The CX ID.
 */
export async function initializeJob({ jobId, cxId }: JobBaseParams): Promise<void> {
  const { log, debug } = out(`Ehr initializeJob - jobId ${jobId} cxId ${cxId}`);
  const api = axios.create({ baseURL: Config.getApiUrl() });
  const queryParams = new URLSearchParams({ cxId });
  const initializeJobUrl = `/internal/patient/job/${jobId}/initialize?${queryParams.toString()}`;
  try {
    const response = await executeWithNetworkRetries(async () => {
      return api.post(initializeJobUrl);
    });
    logAxiosResponse(initializeJobUrl, response, debug);
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
