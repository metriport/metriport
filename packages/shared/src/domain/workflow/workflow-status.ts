import { BadRequestError } from "../../error/bad-request";

export const workflowStatus = ["waiting", "processing", "completed", "failed"] as const;
export type WorkflowStatus = (typeof workflowStatus)[number];
export const initialStatus: WorkflowStatus = "waiting";

export function isWorkflowDone(status: WorkflowStatus): boolean {
  return status === "completed" || status === "failed";
}

/**
 * Validates that a new status is valid based on the current status.
 *
 * @param currentStatus - The current status of the patient import job.
 * @param newStatus - The new status to validate.
 * @returns The validated new status.
 * @throws BadRequestError if the new status is not valid.
 */
export function validateNewStatus(
  currentStatus: WorkflowStatus,
  newStatus: WorkflowStatus
): WorkflowStatus {
  const additionalInfo = {
    currentStatus,
    newStatus,
  };
  switch (newStatus) {
    case "waiting":
      throw new BadRequestError(
        `Waiting is not a valid status to update to`,
        undefined,
        additionalInfo
      );
    case "processing":
      if (currentStatus !== "waiting" && currentStatus !== "processing") {
        throw new BadRequestError(
          `Workflow is not in a valid state to update to processing`,
          undefined,
          additionalInfo
        );
      }
      break;
    case "completed":
      if (currentStatus !== "processing") {
        throw new BadRequestError(
          `Workflow is not processing, cannot update to completed`,
          undefined,
          additionalInfo
        );
      }
      break;
    case "failed":
      if (currentStatus === "completed") {
        throw new BadRequestError(
          `Workflow is completed, cannot update to failed`,
          undefined,
          additionalInfo
        );
      }
      break;
    default:
      throw new BadRequestError(`Invalid workflow status`, undefined, additionalInfo);
  }
  return newStatus;
}
