import { ConsolidationConversionType } from "./conversion/fhir-to-medical-record";
import { createFilePath } from "./filename";

export const MEDICAL_RECORD_KEY = "MR";

export const createMRSummaryFileName = (
  cxId: string,
  patientId: string,
  extension: ConsolidationConversionType
): string => {
  if (extension === "pdf") {
    return createFilePath(cxId, patientId, `${MEDICAL_RECORD_KEY}.html.pdf`);
  }
  return createFilePath(cxId, patientId, `${MEDICAL_RECORD_KEY}.${extension}`);
};
