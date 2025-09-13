import { updateRecordFailedAtApi } from "./api/update-record-failed";
import { updatePatientRecord } from "./record/create-or-update-patient-record";

/**
 * Sets the patient record on the import job as failed. Also increments the failed count on the job
 * status repository in the API.
 */
export async function setPatientRecordFailed({
  cxId,
  jobId,
  rowNumber,
  bucketName,
  reasonForCx,
  reasonForDev,
}: {
  cxId: string;
  jobId: string;
  rowNumber: number;
  bucketName: string;
  reasonForCx: string;
  reasonForDev: string;
}) {
  await Promise.all([
    updateRecordFailedAtApi({ cxId, jobId, rowNumber }),
    updatePatientRecord({
      cxId,
      jobId,
      rowNumber,
      status: "failed",
      reasonForCx,
      reasonForDev,
      bucketName,
    }),
  ]);
}
