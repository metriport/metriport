import { Bundle } from "@medplum/fhirtypes";
import { splitBundleByCompositions } from "./composition-splitter";
import { generateCdaFromFhirBundle } from "./cda-generators";

/**
 * Takes a FHIR bundle, splits it into separate bundles based on FHIR Compositions, and converts each bundle to a CDA document.
 * @param fhirBundle A FHIR Bundle containing Compositions and correlated resources
 * @returns Array of CDA documents in string format
 */
export function convertFhirBundleToCda(fhirBundle: Bundle): string[] {
  const splitBundles = splitBundleByCompositions(fhirBundle);
  return splitBundles.map(generateCdaFromFhirBundle);
}
