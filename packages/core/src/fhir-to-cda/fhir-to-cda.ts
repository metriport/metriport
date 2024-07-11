import { Bundle } from "@medplum/fhirtypes";
import { generateCdaFromFhirBundle } from "./cda-generators";
import { toArray } from "@metriport/shared";

/**
 * Converts each bundle to a CDA document.
 * @param fhirBundle A FHIR Bundle containing Compositions and correlated resources
 * @returns Array of CDA documents in string format
 */
export function convertFhirBundleToCda(fhirBundle: Bundle | Bundle[], orgOid: string): string[] {
  const bundles = toArray(fhirBundle);
  return bundles.map(bundle => generateCdaFromFhirBundle(bundle, orgOid));
}
