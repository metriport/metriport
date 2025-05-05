import { errorToString, JobEntryStatus, MetriportError } from "@metriport/shared";
import axios from "axios";
import { Config } from "../../../../util/config";
import { out } from "../../../../util/log";
import { ApiBaseParams } from "../api-shared";

export type SetJobEntryStatusParams = Pick<ApiBaseParams, "cxId"> & {
  jobId: string;
  entryStatus: JobEntryStatus;
};

/**
 * Sends a request to the API to set the status of a patient job entry.
 * @param jobId - The job ID.
 * @param cxId - The CX ID.
 * @param entryStatus - The status of the job entry.
 */
export async function setJobEntryStatus({
  jobId,
  cxId,
  entryStatus,
}: SetJobEntryStatusParams): Promise<void> {
  const { log, debug } = out(`Ehr setJobEntryStatus - jobId ${jobId} cxId ${cxId}`);
  const api = axios.create({ baseURL: Config.getApiUrl() });
  const queryParams = new URLSearchParams({ cxId, entryStatus });
  const updateJobUrl = `/internal/patient/job/${jobId}/set-entry-status?${queryParams.toString()}`;
  try {
    const response = await api.post(updateJobUrl);
    if (!response.data) throw new Error(`No body returned from ${updateJobUrl}`);
    debug(`${updateJobUrl} resp: ${JSON.stringify(response.data)}`);
  } catch (error) {
    const msg = "Failure while setting job entry status @ Api";
    log(`${msg}. Cause: ${errorToString(error)}`);
    throw new MetriportError(msg, error, {
      cxId,
      jobId,
      entryStatus,
      url: updateJobUrl,
      context: "ehr.setJobEntryStatus",
    });
  }
}
