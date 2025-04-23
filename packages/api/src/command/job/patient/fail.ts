import { PatientJob, validateNewJobStatus } from "@metriport/shared";
import dayjs from "dayjs";
import duration from "dayjs/plugin/duration";
import { FailJobParams } from "../shared";
import { getPatientJobModelOrFail } from "./get";

dayjs.extend(duration);

/**
 * Fails a patient job.
 *
 * @param jobId - The job ID.
 * @param cxId - The customer ID.
 * @param reason - The reason for the failure.
 * @param forceStatusUpdate - Whether to force the status update (only to be used by internal
 *                            flows/endpoints).
 * @returns the updated job.
 * @throws BadRequestError if the failed status is not valid based on the current state.
 * @throws NotFoundError if the job doesn't exist.
 */
export async function failPatientJob({
  jobId,
  cxId,
  reason,
  forceStatusUpdate = false,
}: FailJobParams): Promise<PatientJob> {
  const jobModel = await getPatientJobModelOrFail({ jobId, cxId });
  const job = jobModel.dataValues;
  const currentStatus = job.status;
  const newStatus = forceStatusUpdate ? "failed" : validateNewJobStatus(currentStatus, "failed");

  const fieldsToUpdate: Partial<PatientJob> = { status: newStatus, statusReason: reason };
  const updatedJob = await jobModel.update(fieldsToUpdate);

  return updatedJob.dataValues;
}
