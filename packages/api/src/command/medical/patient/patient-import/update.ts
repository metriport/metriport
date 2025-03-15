import { out } from "@metriport/core/util/log";
import { emptyFunction } from "@metriport/shared";
import { buildDayjs } from "@metriport/shared/common/date";
import { validateNewStatus } from "@metriport/shared/domain/patient/patient-import/status";
import {
  PatientImport,
  PatientImportStatus,
} from "@metriport/shared/domain/patient/patient-import/types";
import dayjs from "dayjs";
import duration from "dayjs/plugin/duration";
import { PatientImportModel } from "../../../../models/medical/patient-import";
import { getPatientImportJobOrFail } from "./get";
import { processPatientImportWebhook } from "./process-patient-import-webhook";

dayjs.extend(duration);

export type PatientImportUpdateCmd = {
  cxId: string;
  jobId: string;
  status: PatientImportStatus;
  total?: number | undefined;
  failed?: number | undefined;
  forceStatusUpdate?: boolean | undefined;
};

/**
 * Updates a bulk patient import job's status and counters.
 * If `total` is provided, the `successful` and `failed` counters are reset.
 *
 * @param cxId - The customer ID.
 * @param jobId - The bulk import job ID.
 * @param status - The new status of the job.
 * @param total - The total number of patients in the job. If provided, the `successful` and
 *                `failed` counters are reset.
 * @param forceStatusUpdate - Whether to force the status update (only to be used by internal
 *                            flows/endpoints).
 * @returns the updated job.
 * @throws BadRequestError if the status is not valid based on the current state.
 * @throws NotFoundError if the job doesn't exist.
 */
export async function updatePatientImport({
  cxId,
  jobId,
  status,
  total,
  failed,
  forceStatusUpdate = false,
}: PatientImportUpdateCmd): Promise<PatientImport> {
  const { log } = out(`updatePatientImport - cxId ${cxId} jobId ${jobId}`);

  const job = await getPatientImportJobOrFail({ cxId, id: jobId });
  const oldStatus = job.status;
  const newStatus = forceStatusUpdate ? status : validateNewStatus(job.status, status);

  const jobToUpdate: PatientImport = { ...job, status: newStatus };
  if (total != undefined) {
    jobToUpdate.total = total;
    jobToUpdate.successful = 0;
    jobToUpdate.failed = 0;
  }
  if (failed != undefined) {
    jobToUpdate.failed = failed;
  }
  if (newStatus === "processing" && oldStatus !== "processing") {
    jobToUpdate.startedAt = buildDayjs().toDate();
  }

  await PatientImportModel.update(jobToUpdate, {
    where: { cxId, id: jobId },
  });

  const justTurnedProcessing = newStatus === "processing" && oldStatus === "waiting";
  const justTurnedCompleted = newStatus === "completed" && oldStatus !== "completed";
  const shouldSendWebhook = justTurnedProcessing || justTurnedCompleted;
  if (shouldSendWebhook) {
    log(`Sending WH to cx for patient import, newStatus ${newStatus}, oldStatus ${oldStatus}`);
    processPatientImportWebhook(jobToUpdate).catch(emptyFunction);
  }
  return jobToUpdate;
}
