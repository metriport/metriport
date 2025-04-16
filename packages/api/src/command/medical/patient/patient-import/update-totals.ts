import { MetriportError } from "@metriport/shared";
import { PatientImportStatus } from "@metriport/shared/domain/patient/patient-import/status";
import { PatientImportEntryStatus } from "@metriport/shared/domain/patient/patient-import/types";
import { IncrementDecrementOptionsWithBy } from "sequelize";
import {
  PatientImportModel,
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
 * @param status - The status of the patient import entry.
 * @returns the updated patient import job.
 */
export async function updateTotals({
  cxId,
  jobId,
  status,
}: {
  cxId: string;
  jobId: string;
  status: PatientImportEntryStatus;
}): Promise<{
  id: string;
  cxId: string;
  status: PatientImportStatus;
  successful: number;
  failed: number;
  total: number;
}> {
  const [[updatedRows]] = await PatientImportModel.increment(
    [
      ...(status === "successful" ? ["successful" as const] : []),
      ...(status === "failed" ? ["failed" as const] : []),
    ],
    {
      where: {
        cxId,
        id: jobId,
      },
      // Sequelize types are a mismatch, had to force this
    } as IncrementDecrementOptionsWithBy<PatientImportModel>
  );
  // Using any because Sequelize doesn't map the columns to the model, even using mapToModel/model
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const updatedRaw = (updatedRows as unknown as any[] | undefined)?.[0];
  if (!updatedRaw) throw new MetriportError("Failed to get updated total from DB");
  return {
    id: updatedRaw[patientImportRawColumnNames.id],
    cxId: updatedRaw[patientImportRawColumnNames.cxId],
    status: updatedRaw[patientImportRawColumnNames.status],
    successful: updatedRaw[patientImportRawColumnNames.successful],
    failed: updatedRaw[patientImportRawColumnNames.failed],
    total: updatedRaw[patientImportRawColumnNames.total],
  };
}
