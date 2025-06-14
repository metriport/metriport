import { PatientJob } from "@metriport/shared";
import { UpdateJobRuntimeDataParams } from "../../shared";
import { getPatientJobModelOrFail } from "../get";

/**
 * Updates a patient job's runtime data.
 *
 * @param jobId - The job ID.
 * @param cxId - The customer ID.
 * @param runtimeData - The runtime data to update. This will replace the existing runtime data.
 * @returns the updated job.
 * @throws BadRequestError if the job total is already set and the job is running.
 * @throws NotFoundError if the job doesn't exist.
 */
export async function updatePatientJobRuntimeData({
  jobId,
  cxId,
  data,
}: UpdateJobRuntimeDataParams): Promise<PatientJob> {
  const jobModel = await getPatientJobModelOrFail({ jobId, cxId });
  const fieldsToUpdate: Partial<Pick<PatientJob, "runtimeData">> = {
    runtimeData: data,
  };
  const updatedJob = await jobModel.update(fieldsToUpdate);
  return updatedJob.dataValues;
}
