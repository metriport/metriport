import { buildPatientImportResult } from "@metriport/core/command/patient-import/steps/result/patient-import-result-factory";
import { out } from "@metriport/core/util";
import { PatientImportEntryStatusFinal } from "@metriport/shared/domain/patient/patient-import/types";
import dayjs from "dayjs";
import duration from "dayjs/plugin/duration";
import { updateTotals } from "./update-totals";

dayjs.extend(duration);

export type FinishPatientImportParams = {
  cxId: string;
  jobId: string;
  status: PatientImportEntryStatusFinal;
};

/**
 * Tries to finish the bulk patient import job, based on a single patient's final bulk import status.
 *
 * Calculates whether it's time to finish the bulk patient import job, based on the number of successful
 * and failed patients.
 *
 * If the bulk patient import job is complete, it will call the service that will finish/complete the
 * bulk patient import job.
 *
 * @param cxId - The customer ID.
 * @param jobId - The bulk import job ID.
 * @param status - The status of the bulk import job.
 */
export async function tryToFinishPatientImport({
  cxId,
  jobId,
  status: singlePatientStatus,
}: FinishPatientImportParams): Promise<void> {
  const { log } = out(`tryToFinishPatientImport - cxId ${cxId}, jobId ${jobId}`);

  const updatedJob = await updateTotals({ cxId, jobId, status: singlePatientStatus });
  const { successful, failed, total, status: currentImportJobStatus } = updatedJob;

  const sum = successful + failed;
  if (sum < total) {
    log(`Sum (${sum}) still lower than total (${total}), no-op.`);
    return;
  }

  if (currentImportJobStatus === `completed`) {
    log(`Status was already completed, no-op.`);
    return;
  }

  log(`Job is complete, triggering PatientImportResult`);
  const next = buildPatientImportResult();
  await next.processJobResult({ cxId, jobId });
}
