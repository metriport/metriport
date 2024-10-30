import { Config } from "../../util/config";

export type ConsolidatedFileType = "original" | "dedup" | "normalize" | "invalid";

export function getConsolidatedLocation() {
  return Config.getMedicalDocumentsBucketName();
}

export function getConsolidatedSourceLocation() {
  return Config.getCdaToFhirConversionBucketName();
}
