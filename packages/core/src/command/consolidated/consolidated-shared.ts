import { Config } from "../../util/config";

export function getConsolidatedLocation() {
  return Config.getMedicalDocumentsBucketName();
}

export function getConsolidatedSourceLocation() {
  return Config.getCdaToFhirConversionBucketName();
}
