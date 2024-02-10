import { createS3FileName } from "../external/aws/s3";

export const MEDICAL_RECORD_KEY = "MR";

export const createMRSummaryFileName = (
  cxId: string,
  patientId: string,
  extension: "pdf" | "html" | "json"
): string => {
  if (extension === "pdf") {
    return createS3FileName(cxId, patientId, `${MEDICAL_RECORD_KEY}.html.pdf`);
  }
  return createS3FileName(cxId, patientId, `${MEDICAL_RECORD_KEY}.${extension}`);
};
