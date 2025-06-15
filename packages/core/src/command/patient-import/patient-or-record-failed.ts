import { updateJobAtApi } from "./api/update-job-status";
import { updatePatientRecord } from "./record/create-or-update-patient-record";

export async function setPatientOrRecordFailed({
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
    updateJobAtApi({ cxId, jobId, failed: 1 }),
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
