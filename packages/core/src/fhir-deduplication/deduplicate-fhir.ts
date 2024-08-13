import { Bundle, BundleEntry, Resource } from "@medplum/fhirtypes";
import { cloneDeep } from "lodash";
import { extractFhirTypesFromBundle } from "../external/fhir/shared/bundle";
import { deduplicateConditions } from "./resources/condition";

// Keeping these for future reference. We're likely going to use some of these with other resources
// const RX_NORM_CODE = "rxnorm";
// const NDC_CODE = "ndc";

// const ICD_9_CODE = "icd-9";
// const LOINC_CODE = "loinc";
// const MEDICARE_CODE = "medicare";
// const CPT_CODE = "cpt";
// const IMO_CODE = "imo";

// common code systems
// const NUCC_SYSTEM = "nucc";
// const US_NPI_SYSTEM = "npi";

export function deduplicateFhir(fhirBundle: Bundle<Resource>): Bundle<Resource> {
  const resourceArrays = extractFhirTypesFromBundle(fhirBundle);
  const deduplicatedEntries: BundleEntry<Resource>[] = [];

  // Rebuild the entries with deduplicated resources and add whatever is left unprocessed
  for (const [key, resources] of Object.entries(resourceArrays)) {
    if (key === "conditions") {
      const deduplicatedConditions = deduplicateConditions(resourceArrays.conditions);
      deduplicatedEntries.push(...deduplicatedConditions);
    } else {
      // Push all other resources unchanged
      const entriesArray = resources && Array.isArray(resources) ? resources : [resources];
      const entriesFlat = entriesArray.flatMap(v => v || []);
      deduplicatedEntries.push(...entriesFlat);
    }
  }

  const deduplicatedBundle: Bundle = cloneDeep(fhirBundle);
  deduplicatedBundle.entry = deduplicatedEntries.map(
    r => ({ resource: r } as BundleEntry<Resource>)
  );
  deduplicatedBundle.total = deduplicatedEntries.length;

  return deduplicatedBundle;
}
