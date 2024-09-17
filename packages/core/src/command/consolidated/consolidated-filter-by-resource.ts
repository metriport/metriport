import { Bundle } from "@medplum/fhirtypes";
import { ResourceTypeForConsolidation } from "@metriport/shared/medical";

/**
 * Filters resources in a FHIR Bundle by date.
 *
 * @param bundle The FHIR Bundle to filter.
 * @param dateFrom The start date for filtering (inclusive).
 * @param dateTo The end date for filtering (inclusive).
 * @returns A new FHIR Bundle based on the original one, containing only the filtered resources.
 */
export function filterBundleByResource(
  bundle: Bundle,
  resources?: ResourceTypeForConsolidation[] | undefined
): Bundle {
  if (!resources || resources.length === 0) {
    return bundle;
  }
  const filtered =
    bundle.entry?.filter(entry => {
      if (!entry.resource) return false;
      return (resources as string[]).includes(entry.resource.resourceType as string);
    }) ?? [];
  return { ...bundle, entry: filtered };
}
