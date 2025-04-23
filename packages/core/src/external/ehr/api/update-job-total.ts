import { errorToString, MetriportError } from "@metriport/shared";
import axios from "axios";
import { Config } from "../../../util/config";
import { out } from "../../../util/log";
import { ApiBaseParams } from "./api-shared";

export type UpdateJobTotalParams = Pick<ApiBaseParams, "cxId"> & {
  jobId: string;
  total: number;
};

/**
 * Sends a request to the API to update the job total.
 * @param jobId - The job ID.
 * @param cxId - The CX ID.
 * @param total - The total number of entries to process.
 */
export async function updateJobTotal({ jobId, cxId, total }: UpdateJobTotalParams): Promise<void> {
  const { log, debug } = out(`Ehr updateJobTotal - jobId ${jobId} cxId ${cxId}`);
  const api = axios.create({ baseURL: Config.getApiUrl() });
  const queryParams = new URLSearchParams({ cxId, total: total.toString() });
  const updateJobUrl = `/internal/job/patient/update-total/${jobId}?${queryParams.toString()}`;
  try {
    const response = await api.post(updateJobUrl);
    if (!response.data) throw new Error(`No body returned from ${updateJobUrl}`);
    debug(`${updateJobUrl} resp: ${JSON.stringify(response.data)}`);
    return response.data;
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
