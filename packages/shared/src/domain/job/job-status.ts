import { BadRequestError } from "../../error/bad-request";

export const jobStatus = ["waiting", "processing", "completed", "failed"] as const;
export type JobStatus = (typeof jobStatus)[number];
export const jobInitialStatus: JobStatus = "waiting";

export function isJobDone(status: JobStatus): boolean {
  return status === "completed" || status === "failed";
}

/**
 * Validates that a new status is valid based on the current status.
 *
 * @param currentStatus - The current status of the job.
 * @param newStatus - The new status to validate.
 * @returns The validated new status.
 * @throws BadRequestError if the new status is not valid.
 */
export function validateNewJobStatus(currentStatus: JobStatus, newStatus: JobStatus): JobStatus {
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
          `Job is not in a valid state to update to processing`,
          undefined,
          additionalInfo
        );
      }
      break;
    case "completed":
      if (currentStatus !== "processing") {
        throw new BadRequestError(
          `Job is not processing, cannot update to completed`,
          undefined,
          additionalInfo
        );
      }
      break;
    case "failed":
      if (currentStatus === "completed") {
        throw new BadRequestError(
          `Job is completed, cannot update to failed`,
          undefined,
          additionalInfo
        );
      }
      break;
    default:
      throw new BadRequestError(`Invalid job status`, undefined, additionalInfo);
  }
  return newStatus;
}
