import { BadRequestError } from "../../../error/bad-request";
import { PatientImportStatus } from "./types";

// TODO 2330 Unit test this
// TODO 2330 Unit test this
// TODO 2330 Unit test this

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
  newStatus: PatientImportStatus
): PatientImportStatus {
  switch (newStatus) {
    case "waiting":
      throw new BadRequestError(`Waiting is not a valid status to update`);
    case "processing":
      if (currentStatus !== "waiting") {
        throw new BadRequestError(`Import job is not waiting, cannot update to processing`);
      }
      break;
    case "completed":
      if (currentStatus !== "processing") {
        throw new BadRequestError(`Import job is not processing, cannot update to completed`);
      }
      break;
    case "failed":
      if (currentStatus !== "processing") {
        throw new BadRequestError(`Import job is not processing, cannot update to failed`);
      }
      break;
    default:
      throw new BadRequestError(`Invalid status ${newStatus}`);
  }
  return newStatus;
}
