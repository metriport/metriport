import { DiagnosticReport, Extension, Reference } from "@medplum/fhirtypes";

export function createExtractedFromExtension(
  extractedFrom: Reference<DiagnosticReport>
): Extension {
  return {
    url: "https://metriport.com/data-extraction",
    valueReference: extractedFrom,
  };
}
