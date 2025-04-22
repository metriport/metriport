import { errorToString, JobEntryStatus, MetriportError } from "@metriport/shared";
import axios from "axios";
import { Config } from "../../../util/config";
import { out } from "../../../util/log";
import { ApiBaseParams } from "./api-shared";

export type UpdateWorkflowTotalParams = Pick<ApiBaseParams, "cxId"> & {
  jobId: string;
  entryStatus: JobEntryStatus;
};

/**
 * Sends a request to the API to update the workflow totals.
 * @param jobId - The job ID.
 * @param cxId - The CX ID.
 * @param entryStatus - The status of the workflow entry.
 */
export async function updateWorkflowTotals({
  jobId,
  cxId,
  entryStatus,
}: UpdateWorkflowTotalParams): Promise<void> {
  const { log, debug } = out(`Ehr updateWorkflowTotals - jobId ${jobId} cxId ${cxId}`);
  const api = axios.create({ baseURL: Config.getApiUrl() });
  const queryParams = new URLSearchParams({
    jobId,
    cxId,
    entryStatus,
  });
  const updateWorkflowUrl = `/internal/job/patient/update-totals?${queryParams.toString()}`;
  try {
    const response = await api.post(updateWorkflowUrl);
    if (!response.data) throw new Error(`No body returned from ${updateWorkflowUrl}`);
    debug(`${updateWorkflowUrl} resp: ${JSON.stringify(response.data)}`);
    return response.data;
  } catch (error) {
    const msg = "Failure while updating workflow totals @ Ehr";
    log(`${msg}. Cause: ${errorToString(error)}`);
    throw new MetriportError(msg, error, {
      cxId,
      jobId,
      entryStatus,
      url: updateWorkflowUrl,
      context: "ehr.updateWorkflowTotal",
    });
  }
}
