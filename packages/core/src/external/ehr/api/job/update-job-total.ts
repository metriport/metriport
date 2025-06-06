import { errorToString, executeWithNetworkRetries, MetriportError } from "@metriport/shared";
import axios from "axios";
import { Config } from "../../../../util/config";
import { out } from "../../../../util/log";
import { validateAndLogResponse } from "../api-shared";
import { JobBaseParams } from "./shared";

export type UpdateJobTotalParams = JobBaseParams & {
  total: number;
};

/**
 * Sends a request to the API to update the job total.
 *
 * @param jobId - The job ID.
 * @param cxId - The CX ID.
 * @param total - The total number of entries to process.
 */
export async function updateJobTotal({ jobId, cxId, total }: UpdateJobTotalParams): Promise<void> {
  const { log, debug } = out(`Ehr updateJobTotal - jobId ${jobId} cxId ${cxId}`);
  const api = axios.create({ baseURL: Config.getApiUrl() });
  const queryParams = new URLSearchParams({ cxId, total: total.toString() });
  const updateJobUrl = `/internal/patient/job/${jobId}/update-total?${queryParams.toString()}`;
  try {
    const response = await executeWithNetworkRetries(async () => {
      return api.post(updateJobUrl);
    });
    validateAndLogResponse(updateJobUrl, response, debug);
  } catch (error) {
    const msg = "Failure while updating job total @ Api";
    log(`${msg}. Cause: ${errorToString(error)}`);
    throw new MetriportError(msg, error, {
      cxId,
      jobId,
      total,
      url: updateJobUrl,
      context: "ehr.updateJobTotal",
    });
  }
}
