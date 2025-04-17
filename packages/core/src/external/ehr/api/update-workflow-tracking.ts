import { errorToString, MetriportError } from "@metriport/shared";
import { EhrSource } from "@metriport/shared/interface/external/ehr/source";
import axios from "axios";
import { Config } from "../../../util/config";
import { out } from "../../../util/log";

export type UpdateWorkflowTrackingParams = {
  ehr: EhrSource;
  cxId: string;
  patientId: string;
  workflowId: string;
  requestId: string;
  total: number;
};

/**
 * Sends a request to the API to update the workflow tracking.
 *
 * @param ehr - The EHR source.
 * @param cxId - The CX ID.
 * @param patientId - The patient ID.
 * @param workflowId - The workflow ID.
 * @param requestId - The request ID.
 * @param total - The total number of things to process.
 */
export async function updateWorkflowTracking({
  ehr,
  cxId,
  patientId,
  workflowId,
  requestId,
  total,
}: UpdateWorkflowTrackingParams): Promise<void> {
  const { log, debug } = out(`Ehr updateWorkflow - cxId ${cxId}`);
  const api = axios.create({ baseURL: Config.getApiUrl() });
  const queryParams = new URLSearchParams({
    cxId,
    patientId,
    workflowId,
    requestId,
    total: total.toString(),
  });
  const updateWorkflowUrl = `/internal/ehr/${ehr}/workflow/update-tracking?${queryParams.toString()}`;
  try {
    const response = await api.post(updateWorkflowUrl);
    if (!response.data) throw new Error(`No body returned from ${updateWorkflowUrl}`);
    debug(`${updateWorkflowUrl} resp: ${JSON.stringify(response.data)}`);
    return response.data;
  } catch (error) {
    const msg = `Failure while updating workflow tracking @ Ehr`;
    log(`${msg}. Cause: ${errorToString(error)}`);
    throw new MetriportError(msg, error, {
      ehr,
      cxId,
      patientId,
      workflowId,
      url: updateWorkflowUrl,
      context: "ehr.updateWorkflowTracking",
    });
  }
}
