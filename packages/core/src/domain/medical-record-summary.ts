import { ConsolidationConversionType } from "./conversion/fhir-to-medical-record";
import { createFilePath } from "./filename";

export const MEDICAL_RECORD_KEY = "MR";

export const createMRSummaryFileName = (
  cxId: string,
  patientId: string,
  extension: ConsolidationConversionType,
  dedupEnabled?: boolean
): string => {
  const fileExtension = extension === "pdf" ? "html.pdf" : extension;
  const filePath = createMRSummaryFileNameWithSuffix(cxId, patientId, dedupEnabled);
  return `${filePath}.${fileExtension}`;
};

export function createMRSummaryFileNameWithSuffix(
  cxId: string,
  patientId: string,
  dedupEnabled?: boolean
): string {
  return createFilePath(cxId, patientId, createFileSuffixBeforeExtension(dedupEnabled));
}

function createFileSuffixBeforeExtension(dedupEnabled?: boolean): string {
  return `${MEDICAL_RECORD_KEY}${dedupEnabled ? "_deduped" : ""}`;
}

export function createSandboxMRSummaryFileName(
  firstName: string,
  extension: "pdf" | "html"
): string {
  return extension === "pdf" ? `${firstName}_MR.html.pdf` : `${firstName}_MR.html`;
}

export const createMRSummaryBriefFileName = (
  cxId: string,
  patientId: string,
  dedupEnabled?: boolean
): string => {
  return createFilePath(
    cxId,
    patientId,
    `${createFileSuffixBeforeExtension(dedupEnabled)}_brief.txt`
  );
};
