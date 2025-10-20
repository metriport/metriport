import { buildPatientImportResult } from "@metriport/core/command/patient-import/steps/result/patient-import-result-factory";
import { out } from "@metriport/core/util";
import { PatientImportEntryStatusFinal } from "@metriport/shared/domain/patient/patient-import/types";
import dayjs from "dayjs";
import duration from "dayjs/plugin/duration";
import { storePatientEntryStatus } from "./store-entry-status";

dayjs.extend(duration);

export type FinishPatientImportParams = {
  cxId: string;
  jobId: string;
  entryStatus: PatientImportEntryStatusFinal;
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
 * @param patientEntryStatus - The status of a single patient/entry in the bulk import job.
 */
export async function tryToFinishPatientImportJob({
  cxId,
  jobId,
  entryStatus,
}: FinishPatientImportParams): Promise<void> {
  const { log } = out(`tryToFinishPatientImport - cxId ${cxId}, jobId ${jobId}`);

  const updatedJob = await storePatientEntryStatus({ cxId, jobId, entryStatus });
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
