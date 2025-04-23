import { MetriportError } from "@metriport/shared";
import { IncrementDecrementOptionsWithBy } from "sequelize";
import { PatientJobModel, patientJobRawColumnNames } from "../../../models/patient-job";
import { UpdateJobTotalsParams, UpdateJobTotalsResponse } from "../shared";
import { updatePatientJobTracking } from "./update-tracking";

/**
 * Updates the totals on the job.
 *
 * It's critical that this updates the successful and failed counters in a concurrent-safe way.
 *
 * We can have multiple requests being processed at the same time, in different Node processes,
 * so we need a way to update the totals without causing race conditions.
 *
 * Based on the status, this will increment the successful or failed counter then call updatePatientJobTracking.
 *
 * @param jobId - The job ID.
 * @param cxId - The customer ID.
 * @param entryStatus - The status of the job entry.
 * @param onCompleted - The callback to call when the job is completed via updatePatientJobTracking.
 * @returns the updated job.
 */
export async function updatePatientJobTotals({
  jobId,
  cxId,
  entryStatus,
  onCompleted,
}: UpdateJobTotalsParams): Promise<UpdateJobTotalsResponse> {
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
    await updatePatientJobTracking({
      jobId,
      cxId,
      status: "completed",
      onCompleted,
    });
  }
  return updatedPatientJob;
}
