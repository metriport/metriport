import { JobRecord } from "@metriport/core/command/patient-import/patient-import";
import { fetchJobRecordOrFail } from "@metriport/core/command/patient-import/record/fetch-job-record";
import { updateJobRecord } from "@metriport/core/command/patient-import/record/update-job-record";
import { out } from "@metriport/core/util/log";
import { buildDayjs } from "@metriport/shared/common/date";
import { PatientImportStatus } from "@metriport/shared/domain/patient/patient-import/types";
import { validateNewStatus } from "@metriport/shared/domain/patient/patient-import/status";
import dayjs from "dayjs";
import duration from "dayjs/plugin/duration";

dayjs.extend(duration);

export type PatientImportUpdateCmd = {
  cxId: string;
  jobId: string;
  status: PatientImportStatus;
  forceStatusUpdate?: boolean | undefined;
};

/**
 * Updates a bulk patient import job.
 *
 * @param cxId - The customer ID.
 * @param jobId - The bulk import job ID.
 * @param status - The new status of the job.
 * @throws BadRequestError if the status is not valid based on the current state.
 */
export async function updatePatientImport({
  cxId,
  jobId,
  status,
  forceStatusUpdate = false,
}: PatientImportUpdateCmd): Promise<JobRecord> {
  const { log } = out(`updatePatientImport - cxId ${cxId} jobId ${jobId}`);

  const jobRecord = await fetchJobRecordOrFail({ cxId, jobId });

  if (jobRecord.status === status) {
    log(`Job already in status ${status}, skipping update`);
    return jobRecord;
  }

  const newStatus = forceStatusUpdate ? status : validateNewStatus(jobRecord.status, status);

  const dataToUpdate = { ...jobRecord, status: newStatus };
  if (newStatus === "processing") {
    dataToUpdate.startedAt = buildDayjs().toISOString();
  }

  const updatedJobRecord = await updateJobRecord(dataToUpdate);

  if (newStatus === "completed") {
    log(`Sending WH to cx for patient import, status ${newStatus} for job`);
    // TODO 2330 send WH to cx
    // await sendWHToCx(updatedJobRecord);
  }
  return updatedJobRecord;
}
