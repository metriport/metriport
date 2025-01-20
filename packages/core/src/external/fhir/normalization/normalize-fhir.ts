import { Bundle, Resource } from "@medplum/fhirtypes";
import { cloneDeep } from "lodash";
import { buildCompleteBundleEntry, extractFhirTypesFromBundle } from "../shared/bundle";
import { normalizeCoverages } from "./resources/coverage";
import { normalizeObservations } from "./resources/observation";

export function normalizeFhir(fhirBundle: Bundle<Resource>): Bundle<Resource> {
  const normalizedBundle = cloneDeep(fhirBundle);
  const resourceArrays = extractFhirTypesFromBundle(normalizedBundle);
  const normalizedCoverages = normalizeCoverages(resourceArrays.coverages);
  resourceArrays.coverages = normalizedCoverages;

  const normalizedObservations = normalizeObservations(resourceArrays.observationVitals);
  resourceArrays.observationVitals = normalizedObservations;

  normalizedBundle.entry = Object.entries(resourceArrays).flatMap(([, resources]) => {
    const entriesArray = Array.isArray(resources) ? resources : [resources];
    return entriesArray.flatMap(v => buildCompleteBundleEntry(v, normalizedBundle.type) || []);
  });

  return normalizedBundle;
}
