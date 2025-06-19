import { PatientJob } from "@metriport/shared";
import { getPatientJobModelOrFail } from "../get";

export type UpdateJobRuntimeDataParams = {
  jobId: string;
  cxId: string;
  data: unknown;
};

/**
 * Updates a patient job's runtime data.
 *
 * @param jobId - The job ID.
 * @param cxId - The customer ID.
 * @param runtimeData - The runtime data to update. This will replace the existing runtime data.
 * @returns the updated job.
 * @throws NotFoundError if the job doesn't exist.
 */
export async function updatePatientJobRuntimeData({
  jobId,
  cxId,
  data,
}: UpdateJobRuntimeDataParams): Promise<PatientJob> {
  const jobModel = await getPatientJobModelOrFail({ jobId, cxId });
  const updatedJob = await jobModel.update({ runtimeData: data });
  return updatedJob.dataValues;
}
