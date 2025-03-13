import { buildPatientImportResult } from "@metriport/core/command/patient-import/steps/result/patient-import-result-factory";
import { out } from "@metriport/core/util";
import { PatientImport } from "@metriport/shared/domain/patient/patient-import/types";
import dayjs from "dayjs";
import duration from "dayjs/plugin/duration";

dayjs.extend(duration);

/**
 * Checks if the bulk patient import/create job is complete and, if so, call the service that will
 * finish/complete the bulk patient import job.
 *
 * @param cxId - The customer ID.
 * @param jobId - The bulk import job ID.
 */
export async function tryToFinishPatientImport({
  cxId,
  id: jobId,
  status,
  total = -1,
  failed = 0,
  successful = 0,
}: PatientImport): Promise<void> {
  const { log } = out(`tryToFinishPatientImport - cxId ${cxId}, jobId ${jobId}`);

  const sum = successful + failed;
  if (sum < total) {
    log(`Sum (${sum}) still lower than total (${total}), no-op.`);
    return;
  }

  if (status === `completed`) {
    log(`Status was already completed, no-op.`);
    return;
  }

  const isComplete = total >= successful + failed;
  if (isComplete) {
    log(`Job is complete, triggering PatientImportResult`);
    const next = buildPatientImportResult();
    await next.processJobResult({ cxId, jobId, dryRun: false });
  }
}
