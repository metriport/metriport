import { BadRequestError } from "../../../error/bad-request";

// TODO 2330 add expired
export const patientImportStatus = ["waiting", "processing", "completed", "failed"] as const;
// export const patientImportStatus = [
//   "waiting",
//   "processing",
//   "completed",
//   "failed",
//   "expired",
// ] as const;
export type PatientImportStatus = (typeof patientImportStatus)[number];

export function isPatientImportDone(status: PatientImportStatus): boolean {
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
  currentStatus: PatientImportStatus,
  newStatus: PatientImportStatus,
  dryRun?: boolean
): PatientImportStatus {
  switch (newStatus) {
    case "waiting":
      throw new BadRequestError(`Waiting is not a valid status to update`, undefined, {
        currentStatus,
        newStatus,
      });
    case "processing":
      if (currentStatus !== "waiting" && currentStatus !== "processing") {
        throw new BadRequestError(
          `Import job is not in a valid state to update to processing`,
          undefined,
          {
            currentStatus,
            newStatus,
          }
        );
      }
      break;
    case "completed":
      if (dryRun && currentStatus === "processing") {
        // When dry-run, we don't want to set the status to completed so (1) the cx can tell
        // whether the patients were imported or not, and (2) we can dry-run a job before we
        // actually import the patients
        return "waiting";
      }
      if (currentStatus !== "processing") {
        throw new BadRequestError(
          `Import job is not processing, cannot update to completed`,
          undefined,
          {
            currentStatus,
            newStatus,
          }
        );
      }
      break;
    case "failed":
      if (currentStatus !== "processing") {
        throw new BadRequestError(
          `Import job is not processing, cannot update to failed`,
          undefined,
          {
            currentStatus,
            newStatus,
          }
        );
      }
      break;
    default:
      throw new BadRequestError(`Invalid import job status`, undefined, {
        currentStatus,
        newStatus,
      });
  }
  return newStatus;
}
