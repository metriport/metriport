import { Bundle, Resource } from "@medplum/fhirtypes";
import { cloneDeep } from "lodash";
import { buildBundleEntry, extractFhirTypesFromBundle } from "../shared/bundle";
import { normalizeCoverages } from "./resources/coverage";

export function normalizeFhir(fhirBundle: Bundle<Resource>): Bundle<Resource> {
  const normalizedBundle: Bundle = cloneDeep(fhirBundle);
  const resourceArrays = extractFhirTypesFromBundle(normalizedBundle);
  const normalizedCoverages = normalizeCoverages(resourceArrays.coverages);
  resourceArrays.coverages = normalizedCoverages;

  normalizedBundle.entry = Object.entries(resourceArrays).flatMap(([, resources]) => {
    const entriesArray = Array.isArray(resources) ? resources : [resources];
    return entriesArray.flatMap(v => buildBundleEntry(v) || []);
  });

  return normalizedBundle;
}
