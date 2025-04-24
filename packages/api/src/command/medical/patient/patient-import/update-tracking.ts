import { out } from "@metriport/core/util/log";
import { emptyFunction } from "@metriport/shared";
import { buildDayjs } from "@metriport/shared/common/date";
import {
  PatientImportJobStatus,
  validateNewStatus,
} from "@metriport/shared/domain/patient/patient-import/status";
import { PatientImportJob } from "@metriport/shared/domain/patient/patient-import/types";
import dayjs from "dayjs";
import duration from "dayjs/plugin/duration";
import { getPatientImportJobModelOrFail } from "./get";
import { processPatientImportJobWebhook } from "./process-patient-import-webhook";

dayjs.extend(duration);

export type PatientImportUpdateStatusCmd = {
  cxId: string;
  jobId: string;
  status?: PatientImportJobStatus;
  total?: number | undefined;
  failed?: number | undefined;
  forceStatusUpdate?: boolean | undefined;
};

/**
 * TODO 2330 Refactor this to match PatientJob's updateTracking(). THe current version allows a
 * caller to update the counters midway through the job, which would override successful/failed
 * counters as well, breaking the job's integrity.
 *
 * Updates a bulk patient import job's status and counters.
 * If `total` is provided, the `successful` and `failed` counters are reset.
 *
 * @param cxId - The customer ID.
 * @param jobId - The bulk import job ID.
 * @param status - The new status of the job.
 * @param total - The total number of patients in the job. If provided, the `successful` and
 *                `failed` counters are reset.
 * @param failed - The number of failed patients in the job.
 * @param forceStatusUpdate - Whether to force the status update (only to be used by internal
 *                            flows/endpoints).
 * @returns the updated job.
 * @throws BadRequestError if the status is not valid based on the current state.
 * @throws NotFoundError if the job doesn't exist.
 */
export async function updatePatientImportTracking({
  cxId,
  jobId,
  status,
  total,
  failed,
  forceStatusUpdate = false,
}: PatientImportUpdateStatusCmd): Promise<PatientImportJob> {
  const { log } = out(`updatePatientImportTracking - cxId ${cxId} jobId ${jobId}`);
  const now = buildDayjs().toDate();
  const job = await getPatientImportJobModelOrFail({ cxId, jobId });
  const { disableWebhooks } = job.paramsOps ?? {};
  const oldStatus = job.status;
  const newStatus = status
    ? forceStatusUpdate
      ? status
      : validateNewStatus(job.status, status)
    : undefined;
  const justTurnedProcessing = newStatus === "processing" && oldStatus !== "processing";
  const justTurnedCompleted = newStatus === "completed" && oldStatus !== "completed";

  const jobToUpdate: PatientImportJob = {
    ...job,
    status: newStatus ?? oldStatus,
  };
  if (total != undefined) {
    jobToUpdate.total = total;
    jobToUpdate.successful = 0;
    jobToUpdate.failed = 0;
  }
  if (failed != undefined) {
    jobToUpdate.failed = failed;
  }
  if (justTurnedProcessing) {
    jobToUpdate.startedAt = now;
  }
  if (justTurnedCompleted) {
    jobToUpdate.finishedAt = now;
  }
  const updatedJobModel = await job.update(jobToUpdate, { where: { cxId, id: jobId } });
  const updatedJob = updatedJobModel.dataValues;

  const shouldSendWebhook = !disableWebhooks && (justTurnedProcessing || justTurnedCompleted);
  if (shouldSendWebhook) {
    log(
      `Sending WH to cx for patient import, newStatus ${newStatus}, ` +
        `oldStatus ${oldStatus}, disableWebhooks ${disableWebhooks}`
    );
    processPatientImportJobWebhook(updatedJob).catch(emptyFunction);
  }
  return updatedJob;
}
