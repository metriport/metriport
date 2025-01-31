import { Config } from "../../util/config";

export type ConsolidatedFileType = "original" | "dedup" | "invalid" | "normalized";

export function getConsolidatedLocation() {
  return Config.getMedicalDocumentsBucketName();
}

export function getConsolidatedSourceLocation() {
  return Config.getCdaToFhirConversionBucketName();
}
