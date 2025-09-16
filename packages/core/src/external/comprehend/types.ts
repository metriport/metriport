import { ICD10CMEntity, RxNormEntity, SNOMEDCTEntity } from "@aws-sdk/client-comprehendmedical";

export type ComprehendType = "rxnorm" | "icd10cm" | "snomedct";
export type ComprehendEntity<T extends ComprehendType> = T extends "rxnorm"
  ? RxNormEntity
  : T extends "icd10cm"
  ? ICD10CMEntity
  : T extends "snomedct"
  ? SNOMEDCTEntity
  : never;

export interface ComprehendConfig {
  confidenceThreshold: number;
  patientId?: string;
  context?: ComprehendContext;
}

export interface ComprehendContext {
  patientId?: string;
  diagnosticReportId?: string;
  encounterId?: string;
  dateNoteWritten?: string;
  extensionUrl?: string;
  // The original text that was processed, and the global offset of it within a larger document
  originalText?: string;
  globalOffsetOfOriginalText?: number;
}
