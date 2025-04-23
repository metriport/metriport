import { MetriportError } from "@metriport/shared";
import { IncrementDecrementOptionsWithBy } from "sequelize";
import { PatientJobModel, patientJobRawColumnNames } from "../../../models/patient-job";
import { UpdateJobCountParams, UpdateJobCountResponse } from "../shared";
import { finishPatientJob } from "./finish";

/**
 * Updates the counts on the job.
 *
 * It's critical that this updates the successful and failed counters in a concurrent-safe way.
 *
 * We can have multiple requests being processed at the same time, in different Node processes,
 * so we need a way to update the totals without causing race conditions.
 *
 * Based on the entry status, this will increment the successful or failed counter then call
 * finishPatientJob if the job is completed.
 *
 * @param jobId - The job ID.
 * @param cxId - The customer ID.
 * @param entryStatus - The status of the job entry.
 * @param onCompleted - The callback to call when the job is completed via finishPatientJob.
 * @returns the updated job.
 */
export async function updatePatientJobCount({
  jobId,
  cxId,
  entryStatus,
  onCompleted,
}: UpdateJobCountParams): Promise<UpdateJobCountResponse> {
  const [[updatedRows]] = await PatientJobModel.increment(
    [
      ...(entryStatus === "successful" ? ["successful" as const] : []),
      ...(entryStatus === "failed" ? ["failed" as const] : []),
    ],
    {
      where: { id: jobId, cxId },
      // Sequelize types are a mismatch, had to force this
    } as IncrementDecrementOptionsWithBy<PatientJobModel>
  );
  // Using any because Sequelize doesn't map the columns to the model, even using mapToModel/model
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const updatedRaw = (updatedRows as unknown as any[] | undefined)?.[0];
  if (!updatedRaw) throw new MetriportError("Failed to get updated total from DB");
  const updatedPatientJob = {
    jobId: updatedRaw[patientJobRawColumnNames.id],
    cxId: updatedRaw[patientJobRawColumnNames.cxId],
    status: updatedRaw[patientJobRawColumnNames.status],
    successful: updatedRaw[patientJobRawColumnNames.successful],
    failed: updatedRaw[patientJobRawColumnNames.failed],
    total: updatedRaw[patientJobRawColumnNames.total],
  };
  const { successful, failed, total, status } = updatedPatientJob;
  if (status !== "completed" && successful + failed >= total) {
    await finishPatientJob({
      jobId,
      cxId,
      onCompleted,
    });
  }
  return updatedPatientJob;
}
