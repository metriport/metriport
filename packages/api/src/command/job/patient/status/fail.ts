import { out } from "@metriport/core/util/log";
import { PatientJob, validateNewJobStatus } from "@metriport/shared";
import { buildDayjs } from "@metriport/shared/common/date";
import { getPatientJobModelOrFail } from "../get";

export type FailJobParams = {
  jobId: string;
  cxId: string;
  reason: string;
  forceStatusUpdate?: boolean;
  onFailed?: () => Promise<void>;
};

/**
 * Fails a patient job.
 *
 * @param jobId - The job ID.
 * @param cxId - The customer ID.
 * @param reason - The reason for failing the job.
 * @param forceStatusUpdate - Whether to force the status update (only to be used by internal flows/endpoints).
 * @param onFailed - The callback to call once the job is failed.
 * @returns the updated job.
 * @throws BadRequestError if the failed status is not valid based on the current state.
 * @throws NotFoundError if the job doesn't exist.
 */
export async function failPatientJob({
  jobId,
  cxId,
  reason,
  forceStatusUpdate = false,
  onFailed,
}: FailJobParams): Promise<PatientJob> {
  const { log } = out(`updateJobTracking - jobId ${jobId} cxId ${cxId}`);
  const jobModel = await getPatientJobModelOrFail({ jobId, cxId });
  const job = jobModel.dataValues;
  const currentStatus = job.status;
  const newStatus = forceStatusUpdate ? "failed" : validateNewJobStatus(currentStatus, "failed");
  const justTurnedFailed = newStatus === "failed" && currentStatus !== "failed";
  // WARNING: DO NOT UPDATE THE COUNTS HERE TO AVOID RACE CONDITIONS.
  const fieldsToUpdate: Partial<Pick<PatientJob, "status" | "statusReason" | "failedAt">> = {
    status: newStatus,
    statusReason: reason,
  };
  if (justTurnedFailed) {
    fieldsToUpdate.failedAt = buildDayjs().toDate();
  }
  const updatedJob = await jobModel.update(fieldsToUpdate);
  if (justTurnedFailed && onFailed) {
    log("onFailed callback triggered");
    await onFailed();
  }
  return updatedJob.dataValues;
}
