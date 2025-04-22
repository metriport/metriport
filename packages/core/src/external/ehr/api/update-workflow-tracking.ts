import { errorToString, JobStatus, MetriportError } from "@metriport/shared";
import axios from "axios";
import { Config } from "../../../util/config";
import { out } from "../../../util/log";
import { ApiBaseParams } from "./api-shared";

export type UpdateWorkflowTrackingParams = Pick<ApiBaseParams, "cxId"> & {
  jobId: string;
  status?: JobStatus;
  total?: number;
};

/**
 * Sends a request to the API to update the workflow tracking.
 *
 * @param jobId - The job ID.
 * @param cxId - The CX ID.
 * @param status - The status of the job. (optional)
 * @param total - The total number of things to process. (optional)
 */
export async function updateWorkflowTracking({
  jobId,
  cxId,
  status,
  total,
}: UpdateWorkflowTrackingParams): Promise<void> {
  const { log, debug } = out(`Ehr updateWorkflowTracking - jobId ${jobId} cxId ${cxId}`);
  const api = axios.create({ baseURL: Config.getApiUrl() });
  const queryParams = new URLSearchParams({
    cxId,
    jobId,
    ...(status && { status }),
    ...(total && { total: total.toString() }),
  });
  const updateWorkflowUrl = `/internal/job/patient/update-tracking?${queryParams.toString()}`;
  try {
    const response = await api.post(updateWorkflowUrl);
    if (!response.data) throw new Error(`No body returned from ${updateWorkflowUrl}`);
    debug(`${updateWorkflowUrl} resp: ${JSON.stringify(response.data)}`);
    return response.data;
  } catch (error) {
    const msg = "Failure while updating workflow tracking @ Ehr";
    log(`${msg}. Cause: ${errorToString(error)}`);
    throw new MetriportError(msg, error, {
      cxId,
      jobId,
      status,
      total,
      url: updateWorkflowUrl,
      context: "ehr.updateWorkflowTracking",
    });
  }
}
