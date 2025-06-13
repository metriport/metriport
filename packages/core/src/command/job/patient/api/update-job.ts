import { errorToString, executeWithNetworkRetries, MetriportError } from "@metriport/shared";
import { logAxiosResponse } from "@metriport/shared/common/response";
import axios from "axios";
import { DischargeRequeryJobRuntimeData } from "../../../../domain/patient-monitoring/discharge-requery";
import { Config } from "../../../../util/config";
import { out } from "../../../../util/log";
import { JobBaseParams } from "./shared";

export type UpdateJobTotalParams = JobBaseParams & {
  total: number;
};

export type UpdateJobRuntimeDataParams = JobBaseParams & {
  runtimeData: DischargeRequeryJobRuntimeData;
  context: string;
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
    logAxiosResponse(updateJobUrl, response, debug);
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

/**
 * Sends a request to the API to update the job runtime data.
 *
 * @param jobId - The job ID.
 * @param cxId - The CX ID.
 * @param runtimeData - The runtime data to update.
 * @param context - The context of the job.
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
  const updateJobUrl = buildUpdateJobRuntimeDataUrl({ jobId, cxId });

  try {
    const response = await executeWithNetworkRetries(async () => {
      return api.post(updateJobUrl);
    });
    logAxiosResponse(updateJobUrl, response, debug);
  } catch (error) {
    const msg = "Failure while updating job runtime data @ Api";
    log(`${msg}. Cause: ${errorToString(error)}`);
    throw new MetriportError(msg, error, {
      cxId,
      jobId,
      runtimeData: JSON.stringify(runtimeData),
      url: updateJobUrl,
      context: fullContext,
    });
  }
}

function buildUpdateJobRuntimeDataUrl({ jobId, cxId }: JobBaseParams): string {
  const queryParams = new URLSearchParams({ cxId });
  return `/internal/patient/job/${jobId}/update-runtime-data?${queryParams.toString()}`;
}
