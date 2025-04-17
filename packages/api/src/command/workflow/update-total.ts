import { MetriportError } from "@metriport/shared";
import { WorkflowEntryStatus } from "@metriport/shared/domain/workflow/types";
import { IncrementDecrementOptionsWithBy } from "sequelize";
import { WorkflowModel, workflowRawColumnNames } from "../../models/workflow";

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
 * @param status - The status of the workflow entry.
 * @returns the updated workflow entry.
 */
export async function updateWorkflowTotals({
  cxId,
  patientId,
  facilityId,
  workflowId,
  requestId,
  status,
}: {
  cxId: string;
  patientId?: string;
  facilityId?: string;
  workflowId: string;
  requestId: string;
  status: WorkflowEntryStatus;
}): Promise<{
  id: string;
  cxId: string;
  status: WorkflowEntryStatus;
  successful: number;
  failed: number;
  total: number;
}> {
  const [[updatedRows]] = await WorkflowModel.increment(
    [
      ...(status === "successful" ? ["successful" as const] : []),
      ...(status === "failed" ? ["failed" as const] : []),
    ],
    {
      where: {
        cxId,
        patientId,
        facilityId,
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
  return {
    id: updatedRaw[workflowRawColumnNames.id],
    cxId: updatedRaw[workflowRawColumnNames.cxId],
    status: updatedRaw[workflowRawColumnNames.status],
    successful: updatedRaw[workflowRawColumnNames.successful],
    failed: updatedRaw[workflowRawColumnNames.failed],
    total: updatedRaw[workflowRawColumnNames.total],
  };
}
