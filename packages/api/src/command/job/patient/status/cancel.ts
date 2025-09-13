import { out } from "@metriport/core/util/log";
import { PatientJob, validateNewJobStatus } from "@metriport/shared";
import { buildDayjs } from "@metriport/shared/common/date";
import { getPatientJobModelOrFail } from "../get";

export type CancelJobParams = {
  jobId: string;
  cxId: string;
  reason: string;
  forceStatusUpdate?: boolean;
  onCancelled?: () => Promise<void>;
};

/**
 * Cancels a patient job.
 *
 * @param jobId - The job ID.
 * @param cxId - The customer ID.
 * @param reason - The reason for cancelling the job.
 * @param forceStatusUpdate - Whether to force the status update (only to be used by internal flows/endpoints).
 * @param onCancelled - The callback to call once the job is cancelled.
 * @returns the updated job.
 * @throws BadRequestError if the cancelled status is not valid based on the current state.
 * @throws NotFoundError if the job doesn't exist.
 */
export async function cancelPatientJob({
  jobId,
  cxId,
  reason,
  forceStatusUpdate = false,
  onCancelled,
}: CancelJobParams): Promise<PatientJob> {
  const { log } = out(`updateJobTracking - jobId ${jobId} cxId ${cxId}`);
  const jobModel = await getPatientJobModelOrFail({ jobId, cxId });
  const job = jobModel.dataValues;
  const currentStatus = job.status;
  const newStatus = forceStatusUpdate
    ? "cancelled"
    : validateNewJobStatus(currentStatus, "cancelled");
  const justTurnedCancelled = newStatus === "cancelled" && currentStatus !== "cancelled";
  // WARNING: DO NOT UPDATE THE COUNTS HERE TO AVOID RACE CONDITIONS.
  const fieldsToUpdate: Partial<Pick<PatientJob, "status" | "statusReason" | "cancelledAt">> = {
    status: newStatus,
    statusReason: reason,
  };
  if (justTurnedCancelled) {
    fieldsToUpdate.cancelledAt = buildDayjs().toDate();
  }
  const updatedJob = await jobModel.update(fieldsToUpdate);
  if (justTurnedCancelled && onCancelled) {
    log("onCancelled callback triggered");
    await onCancelled();
  }
  return updatedJob.dataValues;
}
