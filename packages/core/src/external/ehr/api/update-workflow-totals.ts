import { errorToString, MetriportError } from "@metriport/shared";
import { WorkflowEntryStatus } from "@metriport/shared/domain/workflow/types";
import axios from "axios";
import { Config } from "../../../util/config";
import { out } from "../../../util/log";
import { ApiBaseParams } from "./api-shared";

export type UpdateWorkflowTotalParams = Omit<ApiBaseParams, "practiceId" | "patientId"> & {
  metriportPatientId: string;
  workflowId: string;
  requestId: string;
  entryStatus: WorkflowEntryStatus;
};

/**
 * Sends a request to the API to update the workflow totals.
 *
 * @param ehr - The EHR source.
 * @param cxId - The CX ID.
 * @param metriportPatientId - The Metriport patient ID.
 * @param workflowId - The workflow ID.
 * @param requestId - The request ID.
 * @param entryStatus - The status of the workflow entry.
 */
export async function updateWorkflowTotals({
  ehr,
  cxId,
  metriportPatientId,
  workflowId,
  requestId,
  entryStatus,
}: UpdateWorkflowTotalParams): Promise<void> {
  const { log, debug } = out(`Ehr updateWorkflow - cxId ${cxId}`);
  const api = axios.create({ baseURL: Config.getApiUrl() });
  const queryParams = new URLSearchParams({
    cxId,
    patientId: metriportPatientId,
    workflowId,
    requestId,
    entryStatus,
  });
  const updateWorkflowUrl = `/internal/ehr/${ehr}/workflow/update-totals?${queryParams.toString()}`;
  try {
    const response = await api.post(updateWorkflowUrl);
    if (!response.data) throw new Error(`No body returned from ${updateWorkflowUrl}`);
    debug(`${updateWorkflowUrl} resp: ${JSON.stringify(response.data)}`);
    return response.data;
  } catch (error) {
    const msg = "Failure while updating workflow totals @ Ehr";
    log(`${msg}. Cause: ${errorToString(error)}`);
    throw new MetriportError(msg, error, {
      ehr,
      cxId,
      metriportPatientId,
      workflowId,
      requestId,
      url: updateWorkflowUrl,
      context: "ehr.updateWorkflowTotal",
    });
  }
}
