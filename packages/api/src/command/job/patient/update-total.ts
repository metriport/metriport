import { BadRequestError, PatientJob, isJobDone } from "@metriport/shared";
import { UpdateJobTotalParams } from "../shared";
import { getPatientJobModelOrFail } from "./get";

/**
 * Updates a patient job's total.
 *
 * @param jobId - The job ID.
 * @param cxId - The customer ID.
 * @param total - The total number of patients in the job. The `successful` and `failed` counters
 *                are reset to 0.
 * @returns the updated job.
 * @throws BadRequestError if the job total is already set and the job is running.
 * @throws NotFoundError if the job doesn't exist.
 */
export async function updatePatientJobTotal({
  jobId,
  cxId,
  total,
}: UpdateJobTotalParams): Promise<PatientJob> {
  const jobModel = await getPatientJobModelOrFail({ jobId, cxId });
  const job = jobModel.dataValues;
  const currentTotal = job.total;
  const currentStatus = job.status;
  if (currentTotal > 0 && !isJobDone(currentStatus)) {
    throw new BadRequestError("Job total already set and the job is running");
  }
  const fieldsToUpdate: Partial<PatientJob> = { total, successful: 0, failed: 0 };
  const updatedJob = await jobModel.update(fieldsToUpdate);
  return updatedJob.dataValues;
}
