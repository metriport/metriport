import { Bundle, Resource } from "@medplum/fhirtypes";
import { cloneDeep } from "lodash";
import { buildCompleteBundleEntry, extractFhirTypesFromBundle } from "../shared/bundle";
import { sortCodings } from "./coding";
import { normalizeConditions } from "./resources/condition";
import { normalizeCoverages } from "./resources/coverage";
import { normalizeObservations } from "./resources/observation";

export function normalizeFhir(fhirBundle: Bundle<Resource>): Bundle<Resource> {
  const normalizedBundle: Bundle = cloneDeep(fhirBundle);
  const resourceArrays = extractFhirTypesFromBundle(normalizedBundle);
  const normalizedCoverages = normalizeCoverages(resourceArrays.coverages);
  resourceArrays.coverages = normalizedCoverages;

  const normalizedVitalsObservations = normalizeObservations(resourceArrays.observationVitals);
  resourceArrays.observationVitals = normalizedVitalsObservations;

  const normalizedConditions = normalizeConditions(resourceArrays.conditions);
  resourceArrays.conditions = normalizedConditions;

  normalizedBundle.entry = Object.entries(resourceArrays).flatMap(([, resources]) => {
    const entriesArray = Array.isArray(resources) ? resources : [resources];
    return entriesArray.flatMap(v => buildCompleteBundleEntry(v, normalizedBundle.type) || []);
  });

  return sortCodings(normalizedBundle);
}
