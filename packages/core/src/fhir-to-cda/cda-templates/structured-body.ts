import { Bundle } from "@medplum/fhirtypes";
import { constructResult } from "./components/results";

export function constructStructuredBody(fhirBundle: Bundle): unknown {
  const structuredBody = {
    structuredBody: constructResult(fhirBundle),
  };
  return structuredBody;
}
