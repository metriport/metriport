import { JobEntryStatus, JobStatus, MetriportError } from "@metriport/shared";
import { patientJobRawColumnNames } from "@metriport/shared/domain/job/patient-job";
import { IncrementDecrementOptionsWithBy } from "sequelize";
import { PatientJobModel } from "../../../../models/patient-job";
import { completePatientJob } from "../status/complete";
import { getPatientJobModelOrFail } from "../get";

export type SetPatientJobEntryStatusParams = {
  jobId: string;
  cxId: string;
  entryStatus: JobEntryStatus;
  onCompleted?: () => Promise<void>;
};

export type SetPatientJobEntryStatusResponse = {
  jobId: string;
  cxId: string;
  status: JobStatus;
  successful: number;
  failed: number;
  total: number;
};

/**
 * Sets the status of a patient job entry.
 *
 * It's critical that this updates the successful and failed counters in a concurrent-safe way.
 *
 * We can have multiple requests being processed at the same time, in different Node processes,
 * so we need a way to update the totals without causing race conditions.
 *
 * Based on the entry status, this will increment the successful or failed counter then call
 * completePatientJob if the job is completed.
 *
 * @param jobId - The job ID.
 * @param cxId - The customer ID.
 * @param entryStatus - The status of the job entry.
 * @param onCompleted - The callback to call when the job is completed via completePatientJob.
 * @returns the updated job.
 */
export async function setPatientJobEntryStatus({
  jobId,
  cxId,
  entryStatus,
  onCompleted,
}: SetPatientJobEntryStatusParams): Promise<SetPatientJobEntryStatusResponse> {
  await getPatientJobModelOrFail({ jobId, cxId });
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
    await completePatientJob({
      jobId,
      cxId,
      onCompleted,
    });
  }
  return updatedPatientJob;
}
