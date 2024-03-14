import { Bundle } from "@medplum/fhirtypes"; // Assuming these types are defined
import { splitBundleByCompositions } from "./composition-splitter";
import { generateCdaFromFhirBundle } from "./cda-generators";

export function convertFhirBundleToCda(fhirBundle: Bundle): string[] {
  const splitBundles = splitBundleByCompositions(fhirBundle);
  const cdas: string[] = [];
  for (const bundle of splitBundles) {
    const cda = generateCdaFromFhirBundle(bundle);
    cdas.push(cda);
  }
  return cdas;
}
