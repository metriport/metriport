import { Config } from "../../../../../util/config";
import { FhirToCsvTransformCloud } from "./fhir-to-csv-transform-cloud";
import { FhirToCsvTransformHandler } from "./fhir-to-csv-transform";
import { FhirToCsvTransformHttp } from "./fhir-to-csv-transform-http";

export function buildFhirToCsvTransformHandler(): FhirToCsvTransformHandler {
  if (Config.isDev()) {
    return new FhirToCsvTransformHttp();
  }
  return new FhirToCsvTransformCloud();
}
