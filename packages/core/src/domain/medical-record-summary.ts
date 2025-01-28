import { ConsolidationConversionType } from "./conversion/fhir-to-medical-record";
import { createFilePath } from "./filename";

export const MEDICAL_RECORD_KEY = "MR";

export const createMRSummaryFileName = (
  cxId: string,
  patientId: string,
  extension: ConsolidationConversionType,
  dedupEnabled?: boolean
): string => {
  const fileSuffixBeforeExtension = createFileSuffixBeforeExtension(dedupEnabled);
  const fileExtension = extension === "pdf" ? "html.pdf" : extension;
  const fileSuffix = `${fileSuffixBeforeExtension}.${fileExtension}`;
  const filePath = createFilePath(cxId, patientId, fileSuffix);
  return filePath;
};

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
