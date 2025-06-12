import { out } from "@metriport/core/util/log";
import { PatientJob, validateNewJobStatus } from "@metriport/shared";
import { buildDayjs } from "@metriport/shared/common/date";
import { CompleteJobParams } from "../../shared";
import { getPatientJobModelOrFail } from "../get";

/**
 * Completes a patient job.
 *
 * @param jobId - The job ID.
 * @param cxId - The customer ID.
 * @param forceStatusUpdate - Whether to force the status update (only to be used by internal flows/endpoints).
 * @param onCompleted - The callback to call once the job is updated.
 * @returns the updated job.
 * @throws BadRequestError if the completed status is not valid based on the current state.
 * @throws NotFoundError if the job doesn't exist.
 */
export async function completePatientJob({
  jobId,
  cxId,
  forceStatusUpdate = false,
  onCompleted,
}: CompleteJobParams): Promise<PatientJob> {
  const { log } = out(`updateJobTracking - jobId ${jobId} cxId ${cxId}`);
  const jobModel = await getPatientJobModelOrFail({ jobId, cxId });
  const job = jobModel.dataValues;
  const currentStatus = job.status;
  const newStatus = forceStatusUpdate
    ? "completed"
    : validateNewJobStatus(currentStatus, "completed");
  const justTurnedCompleted = newStatus === "completed" && currentStatus !== "completed";
  // WARNING: DO NOT UPDATE THE COUNTS HERE TO AVOID RACE CONDITIONS.
  const fieldsToUpdate: Partial<Pick<PatientJob, "status" | "finishedAt">> = {
    status: newStatus,
  };
  if (justTurnedCompleted) {
    fieldsToUpdate.finishedAt = buildDayjs().toDate();
  }
  const updatedJob = await jobModel.update(fieldsToUpdate);
  if (justTurnedCompleted && onCompleted) {
    log("onCompleted callback triggered");
    await onCompleted();
  }
  return updatedJob.dataValues;
}
