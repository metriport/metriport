import {
  errorToString,
  executeWithNetworkRetries,
  JobEntryStatus,
  MetriportError,
} from "@metriport/shared";
import { logAxiosResponse } from "@metriport/shared/common/response";
import axios from "axios";
import { Config } from "../../../../util/config";
import { out } from "../../../../util/log";
import { JobBaseParams } from "./shared";

export type SetJobEntryStatusParams = JobBaseParams & {
  entryStatus: JobEntryStatus;
};

/**
 * Sends a request to the API to set the status of a patient job entry.
 *
 * @param jobId - The job ID.
 * @param cxId - The CX ID.
 * @param entryStatus - The status of the job entry.
 */
export async function setJobEntryStatus({
  jobId,
  cxId,
  entryStatus,
}: SetJobEntryStatusParams): Promise<void> {
  const { log, debug } = out(`setJobEntryStatus - jobId ${jobId} cxId ${cxId}`);
  const api = axios.create({ baseURL: Config.getApiUrl() });
  const queryParams = new URLSearchParams({ cxId, entryStatus });
  const updateJobUrl = `/internal/patient/job/${jobId}/set-entry-status?${queryParams.toString()}`;
  try {
    const response = await executeWithNetworkRetries(async () => {
      return api.post(updateJobUrl);
    });
    logAxiosResponse(updateJobUrl, response, debug);
  } catch (error) {
    const msg = "Failure while setting job entry status @ Api";
    log(`${msg}. Cause: ${errorToString(error)}`);
    throw new MetriportError(msg, error, {
      cxId,
      jobId,
      entryStatus,
      url: updateJobUrl,
      context: "patient-job.setJobEntryStatus",
    });
  }
}
