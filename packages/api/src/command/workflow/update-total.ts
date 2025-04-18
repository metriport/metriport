import { MetriportError, WorkflowEntryStatus } from "@metriport/shared";
import { IncrementDecrementOptionsWithBy } from "sequelize";
import { WorkflowModel, workflowRawColumnNames } from "../../models/workflow";
import { updateWorkflowTracking } from "./update-tracking";

export type UpdateWorkflowTotalsParams = {
  cxId: string;
  patientId?: string;
  facilityId?: string;
  workflowId: string;
  requestId: string;
  entryStatus: WorkflowEntryStatus;
  onCompleted?: () => Promise<void> | undefined;
  onCompletedOverride?: () => Promise<void> | undefined;
};

/**
 * Updates the totals on the workflow entry.
 *
 * It's critical that this updates the successful and failed counters in a concurrent-safe way.
 *
 * We can have multiple requests being processed at the same time, in different Node processes,
 * so we need a way to update the totals without causing race conditions.
 *
 * Based on the status, this will increment the successful or failed counter.
 *
 * @param cxId - The customer ID.
 * @param patientId - The patient ID.
 * @param facilityId - The facility ID.
 * @param workflowId - The workflow ID.
 * @param requestId - The request ID.
 * @param entryStatus - The status of the workflow entry.
 * @returns the updated workflow entry.
 */
export async function updateWorkflowTotals({
  cxId,
  patientId,
  facilityId,
  workflowId,
  requestId,
  entryStatus,
  onCompleted,
  onCompletedOverride,
}: UpdateWorkflowTotalsParams): Promise<{
  id: string;
  cxId: string;
  status: WorkflowEntryStatus;
  successful: number;
  failed: number;
  total: number;
}> {
  const [[updatedRows]] = await WorkflowModel.increment(
    [
      ...(entryStatus === "successful" ? ["successful" as const] : []),
      ...(entryStatus === "failed" ? ["failed" as const] : []),
    ],
    {
      where: {
        cxId,
        ...(patientId ? { patientId } : {}),
        ...(facilityId ? { facilityId } : {}),
        workflowId,
        requestId,
      },
      // Sequelize types are a mismatch, had to force this
    } as IncrementDecrementOptionsWithBy<WorkflowModel>
  );
  // Using any because Sequelize doesn't map the columns to the model, even using mapToModel/model
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const updatedRaw = (updatedRows as unknown as any[] | undefined)?.[0];
  if (!updatedRaw) throw new MetriportError("Failed to get updated total from DB");
  const updatedWorkflow = {
    id: updatedRaw[workflowRawColumnNames.id],
    cxId: updatedRaw[workflowRawColumnNames.cxId],
    status: updatedRaw[workflowRawColumnNames.status],
    successful: updatedRaw[workflowRawColumnNames.successful],
    failed: updatedRaw[workflowRawColumnNames.failed],
    total: updatedRaw[workflowRawColumnNames.total],
  };
  const { successful, failed, total, status: currentStatus } = updatedWorkflow;
  if (currentStatus !== "completed" && successful + failed >= total) {
    await updateWorkflowTracking({
      cxId,
      patientId,
      facilityId,
      workflowId,
      requestId,
      status: "completed",
      onCompleted,
      onCompletedOverride,
    });
  }
  return updatedWorkflow;
}
