import { Bundle } from "@medplum/fhirtypes";
import { buildResult } from "./components/results";

export function buildStructuredBody(fhirBundle: Bundle): unknown {
  const structuredBody = {
    structuredBody: buildResult(fhirBundle),
  };
  return structuredBody;
}
