import { Config } from "../../util/config";

export type ConsolidatedFileType = "original" | "deduped" | "normalized" | "invalid";

export function getConsolidatedLocation() {
  return Config.getMedicalDocumentsBucketName();
}

export function getConsolidatedSourceLocation() {
  return Config.getCdaToFhirConversionBucketName();
}
