import { errorToString, executeWithNetworkRetries, MetriportError } from "@metriport/shared";
import { logAxiosResponse } from "@metriport/shared/common/response";
import axios from "axios";
import { Config } from "../../../../util/config";
import { out } from "../../../../util/log";
import { JobBaseParams } from "./shared";

export type UpdateJobRuntimeDataParams = JobBaseParams & {
  runtimeData: unknown;
  context: string;
};

/**
 * Sends a request to the API to update the job runtime data.
 *
 * @param jobId - The job ID.
 * @param cxId - The CX ID.
 * @param runtimeData - The runtime data to update.
 */
export async function updateJobRuntimeData({
  jobId,
  cxId,
  runtimeData,
  context,
}: UpdateJobRuntimeDataParams): Promise<void> {
  const fullContext = `${context}.updateJobRuntimeData`;
  const { log, debug } = out(`${fullContext} - jobId ${jobId} cxId ${cxId}`);
  const api = axios.create({ baseURL: Config.getApiUrl() });
  const queryParams = new URLSearchParams({ cxId });
  const updateJobUrl = `/internal/patient/job/${jobId}/runtime-data?${queryParams.toString()}`;
  try {
    const response = await executeWithNetworkRetries(async () => {
      return api.post(updateJobUrl, { data: runtimeData });
    });
    logAxiosResponse(updateJobUrl, response, debug);
  } catch (error) {
    const msg = "Failure while updating job runtime data @ Api";
    log(`${msg}. Cause: ${errorToString(error)}`);
    throw new MetriportError(msg, error, {
      cxId,
      jobId,
      url: updateJobUrl,
      context: fullContext,
    });
  }
}
