import { errorToString, executeWithNetworkRetries, MetriportError } from "@metriport/shared";
import axios from "axios";
import { Config } from "../../../../util/config";
import { out } from "../../../../util/log";
import { ApiBaseParams, validateAndLogResponse } from "../api-shared";

export type CompleteJobParams = Pick<ApiBaseParams, "cxId"> & {
  jobId: string;
};

/**
 * Sends a request to the API to complete the job.
 * @param jobId - The job ID.
 * @param cxId - The CX ID.
 */
export async function completeJob({ jobId, cxId }: CompleteJobParams): Promise<void> {
  const { log, debug } = out(`Ehr completeJob - jobId ${jobId} cxId ${cxId}`);
  const api = axios.create({ baseURL: Config.getApiUrl() });
  const queryParams = new URLSearchParams({ cxId });
  const completeJobUrl = `/internal/patient/job/${jobId}/complete?${queryParams.toString()}`;
  try {
    const response = await executeWithNetworkRetries(async () => {
      return api.post(completeJobUrl);
    });
    validateAndLogResponse(completeJobUrl, response, debug);
  } catch (error) {
    const msg = "Failure while completing job @ Api";
    log(`${msg}. Cause: ${errorToString(error)}`);
    throw new MetriportError(msg, error, {
      cxId,
      jobId,
      url: completeJobUrl,
      context: "ehr.completeJob",
    });
  }
}
