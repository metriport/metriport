import { out } from "@metriport/core/util/log";
import { buildDayjs } from "@metriport/shared/common/date";
import { Workflow } from "@metriport/shared/domain/workflow/types";
import {
  WorkflowStatus,
  validateNewStatus,
} from "@metriport/shared/domain/workflow/workflow-status";
import dayjs from "dayjs";
import duration from "dayjs/plugin/duration";
import { getWorkflowModelOrFail } from "./get";

dayjs.extend(duration);

export type WorkflowUpdateTrackingCmd = {
  cxId: string;
  patientId?: string;
  facilityId?: string;
  workflowId: string;
  requestId: string;
  status?: WorkflowStatus;
  total?: number | undefined;
  failed?: number | undefined;
  forceStatusUpdate?: boolean | undefined;
  onCompleted?: () => Promise<void> | undefined;
};

/**
 * Updates a bulk patient import job's status and counters.
 * If `total` is provided, the `successful` and `failed` counters are reset.
 *
 * @param cxId - The customer ID.
 * @param jobId - The bulk import job ID.
 * @param status - The new status of the job.
 * @param total - The total number of patients in the job. If provided, the `successful` and
 *                `failed` counters are reset.
 * @param failed - The number of failed patients in the job.
 * @param forceStatusUpdate - Whether to force the status update (only to be used by internal
 *                            flows/endpoints).
 * @returns the updated job.
 * @throws BadRequestError if the status is not valid based on the current state.
 * @throws NotFoundError if the job doesn't exist.
 */
export async function updateWorkflowTracking({
  cxId,
  patientId,
  facilityId,
  workflowId,
  requestId,
  status,
  total,
  failed,
  forceStatusUpdate = false,
  onCompleted,
}: WorkflowUpdateTrackingCmd): Promise<Workflow> {
  const { log } = out(
    `updateWorkflowTracking - cxId ${cxId} patientId ${patientId} facilityId ${facilityId} workflowId ${workflowId} requestId ${requestId}`
  );

  const workflowModel = await getWorkflowModelOrFail({
    cxId,
    patientId,
    facilityId,
    workflowId,
    requestId,
  });
  const workflow = workflowModel.dataValues;
  const oldStatus = workflow.status;
  const newStatus = status
    ? forceStatusUpdate
      ? status
      : validateNewStatus(workflow.status, status)
    : undefined;
  const justTurnedProcessing = newStatus === "processing" && oldStatus !== "processing";
  const justTurnedCompleted = newStatus === "completed" && oldStatus !== "completed";

  const workflowToUpdate: Workflow = {
    ...workflow,
    status: newStatus ?? oldStatus,
  };
  if (total != undefined) {
    workflowToUpdate.total = total;
    workflowToUpdate.successful = 0;
    workflowToUpdate.failed = 0;
  }
  if (failed != undefined) {
    workflowToUpdate.failed = failed;
  }
  if (justTurnedProcessing) {
    workflowToUpdate.startedAt = buildDayjs().toDate();
  }
  const updatedWorkflow = await workflowModel.update(workflowToUpdate);

  if (justTurnedCompleted && onCompleted) {
    log("o Calling onCompleted");
    await onCompleted();
  }

  return updatedWorkflow.dataValues;
}
