import { out } from "@metriport/core/util/log";
import { PatientJob, validateNewJobStatus } from "@metriport/shared";
import { buildDayjs } from "@metriport/shared/common/date";
import dayjs from "dayjs";
import duration from "dayjs/plugin/duration";
import { UpdateJobTrackingParams } from "../shared";
import { getPatientJobModelOrFail } from "./get";

dayjs.extend(duration);

/**
 * Updates a patient job's status and counters.
 * If `total` is provided, the `successful` and `failed` counters are reset.
 *
 * @param jobId - The job ID.
 * @param cxId - The customer ID.
 * @param status - The new status of the job.
 * @param total - The total number of patients in the job. If provided, the `successful` and
 *                `failed` counters are reset.
 * @param forceStatusUpdate - Whether to force the status update (only to be used by internal
 *                            flows/endpoints).
 * @param onCompleted - The callback to call when the job is completed.
 * @returns the updated job.
 * @throws BadRequestError if the status is not valid based on the current state.
 * @throws NotFoundError if the job doesn't exist.
 */
export async function updatePatientJobTracking({
  jobId,
  cxId,
  status,
  total,
  forceStatusUpdate = false,
  onCompleted,
}: UpdateJobTrackingParams): Promise<PatientJob> {
  const { log } = out(`updateJobTracking - jobId ${jobId} cxId ${cxId}`);
  const jobModel = await getPatientJobModelOrFail({
    jobId,
    cxId,
  });
  const job = jobModel.dataValues;
  const oldStatus = job.status;
  const newStatus = status
    ? forceStatusUpdate
      ? status
      : validateNewJobStatus(job.status, status)
    : undefined;
  const justTurnedProcessing = newStatus === "processing" && oldStatus !== "processing";
  const justTurnedCompleted = newStatus === "completed" && oldStatus !== "completed";

  const fieldsToUpdate: Partial<PatientJob> = {
    status: newStatus ?? oldStatus,
  };
  if (total != undefined) {
    fieldsToUpdate.total = total;
    fieldsToUpdate.successful = 0;
    fieldsToUpdate.failed = 0;
  }
  if (justTurnedProcessing) {
    fieldsToUpdate.startedAt = buildDayjs().toDate();
  }
  if (justTurnedCompleted) {
    fieldsToUpdate.finishedAt = buildDayjs().toDate();
  }
  const updatedJob = await jobModel.update(fieldsToUpdate);

  if (justTurnedCompleted && onCompleted) {
    log("onCompleted callback triggered");
    await onCompleted();
  }

  return updatedJob.dataValues;
}
