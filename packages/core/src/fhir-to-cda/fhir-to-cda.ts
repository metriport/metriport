import { Bundle } from "@medplum/fhirtypes";
import { generateCdaFromFhirBundle } from "./cda-generators";
import { splitBundleByCompositions } from "./composition-splitter";

/**
 * Takes a FHIR bundle, splits it into separate bundles based on FHIR Compositions, and converts each bundle to a CDA document.
 * @param fhirBundle A FHIR Bundle containing Compositions and correlated resources
 * @returns Array of CDA documents in string format
 */
export function convertFhirBundleToCda(fhirBundle: Bundle, orgOid: string): string[] {
  const splitBundles = splitBundleByCompositions(fhirBundle);
  return splitBundles.map(bundle => generateCdaFromFhirBundle(bundle, orgOid));
}
