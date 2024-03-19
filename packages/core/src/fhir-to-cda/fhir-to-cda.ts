import { Bundle } from "@medplum/fhirtypes";
import { splitBundleByCompositions } from "./composition-splitter";
import { generateCdaFromFhirBundle } from "./cda-generators";

export function convertFhirBundleToCda(fhirBundle: Bundle): string[] {
  const splitBundles = splitBundleByCompositions(fhirBundle);
  return splitBundles.map(generateCdaFromFhirBundle);
}
