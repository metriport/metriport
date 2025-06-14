import { PatientJob, validateNewJobStatus } from "@metriport/shared";
import { buildDayjs } from "@metriport/shared/common/date";
import { InitializeJobParams } from "../../shared";
import { getPatientJobModelOrFail } from "../get";

/**
 * Initializes a patient job.
 *
 * @param jobId - The job ID.
 * @param cxId - The customer ID.
 * @param forceStatusUpdate - Whether to force the status update (only to be used by internal flows/endpoints).
 * @returns the updated job.
 * @throws BadRequestError if the processing status is not valid based on the current state.
 * @throws NotFoundError if the job doesn't exist.
 */
export async function initializePatientJob({
  jobId,
  cxId,
  forceStatusUpdate = false,
}: InitializeJobParams): Promise<PatientJob> {
  const jobModel = await getPatientJobModelOrFail({ jobId, cxId });
  const job = jobModel.dataValues;
  const currentStatus = job.status;
  const newStatus = forceStatusUpdate
    ? "processing"
    : validateNewJobStatus(currentStatus, "processing");
  const justTurnedProcessing = newStatus === "processing" && currentStatus !== "processing";
  // WARNING: DO NOT UPDATE THE COUNTS HERE TO AVOID RACE CONDITIONS.
  const fieldsToUpdate: Partial<Pick<PatientJob, "status" | "startedAt">> = {
    status: newStatus,
  };
  if (justTurnedProcessing) {
    fieldsToUpdate.startedAt = buildDayjs().toDate();
  }
  const updatedJob = await jobModel.update(fieldsToUpdate);
  return updatedJob.dataValues;
}
