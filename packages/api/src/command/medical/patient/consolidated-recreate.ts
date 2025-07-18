import { ConsolidationConversionType } from "@metriport/api-sdk";
import { deleteConsolidated } from "@metriport/core/command/consolidated/consolidated-delete";
import { ConsolidatedSnapshotRequestSync } from "@metriport/core/command/consolidated/get-snapshot";
import { buildConsolidatedSnapshotConnector } from "@metriport/core/command/consolidated/get-snapshot-factory";
import { makeIngestConsolidated } from "@metriport/core/command/consolidated/search/fhir-resource/ingest-consolidated-factory";
import { Patient } from "@metriport/core/domain/patient";
import { processAsyncError } from "@metriport/core/util/error/shared";
import { out } from "@metriport/core/util/log";
import { startCreateResourceDiffBundlesJobsAcrossEhrs } from "../../../external/ehr/shared/job/bundle/create-resource-diff-bundles/start-jobs-across-ehrs";
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
  requestId,
  isDq = false,
}: {
  patient: Patient;
  conversionType?: ConsolidationConversionType;
  context?: string;
  requestId?: string;
  isDq?: boolean;
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
    if (conversionType) {
      log(`Getting consolidated bundle with conversion type ${conversionType} (sync)`);
      await getConsolidated({ patient, conversionType });
      log(`Consolidated recreated`);
    } else {
      log(`Building consolidated bundle without conversion (async)`);
      const payload: ConsolidatedSnapshotRequestSync = {
        patient,
        isAsync: false,
        sendAnalytics: true,
      };
      const connector = buildConsolidatedSnapshotConnector();
      await connector.execute(payload);
      log(`Consolidated triggered`);
    }

    const ingestor = makeIngestConsolidated();
    ingestor
      .ingestConsolidatedIntoSearchEngine({
        cxId: patient.cxId,
        patientId: patient.id,
      })
      .catch(processAsyncError("Post-DQ ingestConsolidatedIntoSearchEngine"));

    if (isDq) {
      startCreateResourceDiffBundlesJobsAcrossEhrs({
        cxId: patient.cxId,
        patientId: patient.id,
        requestId,
      }).catch(processAsyncError("Post-DQ startCreateResourceDiffBundlesJobsAcrossEhrs"));
    }
  } catch (err) {
    processAsyncError(`Post-DQ getConsolidated`, log)(err);
  }
}
