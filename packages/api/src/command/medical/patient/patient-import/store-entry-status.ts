import { MetriportError } from "@metriport/shared";
import {
  PatientImportEntryStatus,
  PatientImportJob,
} from "@metriport/shared/domain/patient/patient-import/types";
import { IncrementDecrementOptionsWithBy } from "sequelize";
import {
  PatientImportJobModel,
  patientImportRawColumnNames,
} from "../../../../models/medical/patient-import";

/**
 * Updates the totals on the patient import job.
 *
 * It's critical that this updates the successful and failed counters in a concurrent-safe way.
 *
 * We can have multiple requests being processed at the same time, in different Node processes,
 * so we need a way to update the totals without causing race conditions.
 *
 * Based on the status, this will increment the successful or failed counter.
 *
 * @param cxId - The customer ID.
 * @param jobId - The bulk import job ID.
 * @param entryStatus - The status of the patient entry.
 * @returns the updated patient import job.
 */
export async function storePatientEntryStatus({
  cxId,
  jobId,
  entryStatus,
}: {
  cxId: string;
  jobId: string;
  entryStatus: PatientImportEntryStatus;
}): Promise<Pick<PatientImportJob, "id" | "cxId" | "status" | "successful" | "failed" | "total">> {
  const [[updatedRows]] = await PatientImportJobModel.increment(
    [
      ...(entryStatus === "successful" ? ["successful" as const] : []),
      ...(entryStatus === "failed" ? ["failed" as const] : []),
    ],
    {
      where: {
        cxId,
        id: jobId,
      },
      // Sequelize types are a mismatch, had to force this
    } as IncrementDecrementOptionsWithBy<PatientImportJobModel>
  );
  // Using any because Sequelize doesn't map the columns to the model, even using mapToModel/model
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const updatedRaw = (updatedRows as unknown as any[] | undefined)?.[0];
  if (!updatedRaw) throw new MetriportError("Failed to get updated total from DB");
  return {
    id: updatedRaw[patientImportRawColumnNames.id],
    cxId: updatedRaw[patientImportRawColumnNames.cxId],
    status: updatedRaw[patientImportRawColumnNames.status],
    successful: parseInt(updatedRaw[patientImportRawColumnNames.successful]),
    failed: parseInt(updatedRaw[patientImportRawColumnNames.failed]),
    total: parseInt(updatedRaw[patientImportRawColumnNames.total]),
  };
}
