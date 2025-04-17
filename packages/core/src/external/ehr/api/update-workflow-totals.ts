import { errorToString, MetriportError } from "@metriport/shared";
import { WorkflowEntryStatus } from "@metriport/shared/domain/workflow/types";
import { EhrSource } from "@metriport/shared/interface/external/ehr/source";
import axios from "axios";
import { Config } from "../../../util/config";
import { out } from "../../../util/log";

export type UpdateWorkflowTotalParams = {
  ehr: EhrSource;
  cxId: string;
  patientId: string;
  workflowId: string;
  requestId: string;
  status: WorkflowEntryStatus;
};

/**
 * Sends a request to the API to save a resource diff.
 *
 * @param ehr - The EHR source.
 * @param cxId - The CX ID.
 * @param patientId - The patient ID.
 * @param workflowId - The workflow ID.
 * @param requestId - The request ID.
 * @param status - The status of the workflow entry.
 */
export async function updateWorkflowTotals({
  ehr,
  cxId,
  patientId,
  workflowId,
  requestId,
  status,
}: UpdateWorkflowTotalParams): Promise<void> {
  const { log, debug } = out(`Ehr updateWorkflow - cxId ${cxId}`);
  const api = axios.create({ baseURL: Config.getApiUrl() });
  const queryParams = new URLSearchParams({
    cxId,
    patientId,
    workflowId,
    requestId,
    status,
  });
  const updateWorkflowUrl = `/internal/ehr/${ehr}/workflow/update-totals?${queryParams.toString()}`;
  try {
    const response = await api.post(updateWorkflowUrl);
    if (!response.data) throw new Error(`No body returned from ${updateWorkflowUrl}`);
    debug(`${updateWorkflowUrl} resp: ${JSON.stringify(response.data)}`);
    return response.data;
  } catch (error) {
    const msg = `Failure while updating workflow totals @ Ehr`;
    log(`${msg}. Cause: ${errorToString(error)}`);
    throw new MetriportError(msg, error, {
      ehr,
      cxId,
      patientId,
      workflowId,
      url: updateWorkflowUrl,
      context: "ehr.updateWorkflowTotal",
    });
  }
}
