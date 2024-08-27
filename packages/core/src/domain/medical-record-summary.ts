import { ConsolidationConversionType } from "./conversion/fhir-to-medical-record";
import { createFilePath } from "./filename";

export const MEDICAL_RECORD_KEY = "MR";

export const createMRSummaryFileName = (
  cxId: string,
  patientId: string,
  extension: ConsolidationConversionType,
  dedupEnabled?: boolean
): string => {
  if (extension === "pdf") {
    return createFilePath(
      cxId,
      patientId,
      `${MEDICAL_RECORD_KEY}${dedupEnabled ? "_deduped" : ""}.html.pdf`
    );
  }
  return createFilePath(
    cxId,
    patientId,
    `${MEDICAL_RECORD_KEY}${dedupEnabled ? "_deduped" : ""}.${extension}`
  );
};

export const createMRSummaryBriefFileName = (
  cxId: string,
  patientId: string,
  dedupEnabled?: boolean
): string => {
  return createFilePath(
    cxId,
    patientId,
    `${MEDICAL_RECORD_KEY}${dedupEnabled ? "_deduped" : ""}_brief.txt`
  );
};
