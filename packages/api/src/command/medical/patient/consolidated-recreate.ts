import { ConsolidationConversionType } from "@metriport/api-sdk";
import { deleteConsolidated } from "@metriport/core/command/consolidated/consolidated-delete";
import { Patient } from "@metriport/core/domain/patient";
import { processAsyncError } from "@metriport/core/util/error/shared";
import { out } from "@metriport/core/util/log";
import { getConsolidated } from "../patient/consolidated-get";

/**
 * Recreates the consolidated bundle for a patient.
 *
 * Intentionally not throwing errors to avoid breaking the flow of the calling function.
 *
 * @param patient - The patient to recreate the consolidated bundle for.
 * @param organization - The organization to recreate the consolidated bundle for.
 * @param conversionType - The conversion type to use when converting to consolidatd.
 * @param context - Optional context to log.
 */
export async function recreateConsolidated({
  patient,
  conversionType,
  context,
}: {
  patient: Patient;
  conversionType?: ConsolidationConversionType;
  context?: string;
}): Promise<void> {
  const { log } = out(`${context ? context + " " : ""}recreateConsolidated - pt ${patient.id}`);
  try {
    await deleteConsolidated({
      cxId: patient.cxId,
      patientId: patient.id,
    });
  } catch (err) {
    processAsyncError(`Failed to delete consolidated bundle`, log)(err);
  }
  try {
    await getConsolidated({ patient, conversionType });
  } catch (err) {
    processAsyncError(`Post-DQ getConsolidated`, log)(err);
  }
}
