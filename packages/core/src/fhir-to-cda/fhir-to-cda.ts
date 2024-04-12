import { Bundle } from "@medplum/fhirtypes";
import { splitBundleByCompositions } from "./composition-splitter";
import { generateCdaFromFhirBundle } from "./cda-generators";

export function convertFhirBundleToCda(fhirBundle: Bundle, orgOid: string): string[] {
  const splitBundles = splitBundleByCompositions(fhirBundle);
  return splitBundles.map(bundle => generateCdaFromFhirBundle(bundle, orgOid));
}
