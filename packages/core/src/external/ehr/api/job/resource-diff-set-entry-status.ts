import { errorToString, JobEntryStatus, MetriportError } from "@metriport/shared";
import axios from "axios";
import { Config } from "../../../../util/config";
import { out } from "../../../../util/log";
import { ApiBaseParams } from "../api-shared";

export type SetResourceDiffJobEntryStatusParams = ApiBaseParams & {
  jobId: string;
  entryStatus: JobEntryStatus;
};

/**
 * Sends a request to the API to set the status of a patient job entry for a resource diff job.
 * @param ehr - The EHR source.
 * @param cxId - The CX ID.
 * @param practiceId - The practice ID.
 * @param patientId - The patient ID.
 * @param jobId - The job ID.
 * @param entryStatus - The status of the job entry.
 */
export async function setResourceDiffJobEntryStatus({
  ehr,
  cxId,
  practiceId,
  patientId,
  jobId,
  entryStatus,
}: SetResourceDiffJobEntryStatusParams): Promise<void> {
  const { log, debug } = out(`Ehr setResourceDiffJobEntryStatus - jobId ${jobId} cxId ${cxId}`);
  const api = axios.create({ baseURL: Config.getApiUrl() });
  const queryParams = new URLSearchParams({
    cxId,
    practiceId,
    jobId,
    entryStatus,
  });
  const updateJobUrl = `/internal/ehr/${ehr}/patient/${patientId}/resource/diff/set-entry-status?${queryParams.toString()}`;
  try {
    const response = await api.post(updateJobUrl);
    if (!response.data) throw new Error(`No body returned from ${updateJobUrl}`);
    debug(`${updateJobUrl} resp: ${JSON.stringify(response.data)}`);
  } catch (error) {
    const msg = "Failure while setting resource diff job entry status @ Api";
    log(`${msg}. Cause: ${errorToString(error)}`);
    throw new MetriportError(msg, error, {
      cxId,
      jobId,
      entryStatus,
      url: updateJobUrl,
      context: "ehr.setResourceDiffJobEntryStatus",
    });
  }
}
