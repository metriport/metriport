import { Bundle, Resource } from "@medplum/fhirtypes";
import { cloneDeep } from "lodash";
import { buildBundleEntry, extractFhirTypesFromBundle } from "../shared/bundle";
import { normalizeCoverages } from "./resources/coverage";
import { normalizeObservations } from "./resources/observation";

export function normalizeFhir(fhirBundle: Bundle<Resource>): Bundle<Resource> {
  const normalizedBundle: Bundle = cloneDeep(fhirBundle);
  const resourceArrays = extractFhirTypesFromBundle(normalizedBundle);
  const normalizedCoverages = normalizeCoverages(resourceArrays.coverages);
  resourceArrays.coverages = normalizedCoverages;

  const normalizedVitalsObservations = normalizeObservations(resourceArrays.observationVitals);
  resourceArrays.observationVitals = normalizedVitalsObservations;

  normalizedBundle.entry = Object.entries(resourceArrays).flatMap(([, resources]) => {
    const entriesArray = Array.isArray(resources) ? resources : [resources];
    return entriesArray.flatMap(v => buildBundleEntry(v) || []);
  });

  return normalizedBundle;
}
