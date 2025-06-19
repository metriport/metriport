import { BadRequestError, PatientJob } from "@metriport/shared";
import { getPatientJobModelOrFail } from "../get";

export type UpdateJobTotalParams = {
  jobId: string;
  cxId: string;
  total: number;
  forceTotalUpdate?: boolean;
};

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
  if (total < 1) throw new BadRequestError("Total must be greater than 0");
  // WARNING: DO NOT UPDATE THE STATUS HERE TO AVOID RACE CONDITIONS.
  const fieldsToUpdate: Partial<Pick<PatientJob, "total" | "successful" | "failed">> = {
    total,
    successful: 0,
    failed: 0,
  };
  const updatedJob = await jobModel.update(fieldsToUpdate);
  return updatedJob.dataValues;
}
