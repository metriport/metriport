import { PatientJob, validateNewJobStatus } from "@metriport/shared";
import { buildDayjs } from "@metriport/shared/common/date";
import dayjs from "dayjs";
import duration from "dayjs/plugin/duration";
import { InitializeJobParams } from "../shared";
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
export async function initializePatientJob({
  jobId,
  cxId,
  forceStatusUpdate = false,
}: InitializeJobParams): Promise<PatientJob> {
  const jobModel = await getPatientJobModelOrFail({ jobId, cxId });
  const job = jobModel.dataValues;
  const currentStatus = job.status;
  const newStatus = forceStatusUpdate
    ? "processing"
    : validateNewJobStatus(currentStatus, "processing");
  const justTurnedProcessing = newStatus === "processing" && currentStatus !== "processing";
  const fieldsToUpdate: Partial<PatientJob> = { status: newStatus };
  if (justTurnedProcessing) {
    fieldsToUpdate.startedAt = buildDayjs().toDate();
  }
  const updatedJob = await jobModel.update(fieldsToUpdate);
  return updatedJob.dataValues;
}
