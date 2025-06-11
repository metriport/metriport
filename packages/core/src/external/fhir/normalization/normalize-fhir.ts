import { Bundle, Resource } from "@medplum/fhirtypes";
import { cloneDeep } from "lodash";
import { buildCompleteBundleEntry, extractFhirTypesFromBundle } from "../bundle/bundle";
import { sortCodings } from "./coding";
import { normalizeConditions } from "./resources/condition";
import { normalizeCoverages } from "./resources/coverage";
import { filterInvalidEncounters } from "./resources/encounter";
import { normalizeObservations } from "./resources/observation";

/**
 * Normalizes a FHIR Bundle by standardizing and cleaning up its resources.
 *
 * This function performs the following normalizations:
 * - Normalizes Coverage resources
 * - Normalizes Vital Signs Observations
 * - Normalizes Condition resources
 * - Filters out empty Encounter resources
 * - Cleans up and sorts all codings within the resources
 *
 * @param fhirBundle - The FHIR Bundle to normalize
 * @returns A new normalized FHIR Bundle with standardized resources
 */

export function normalizeFhir(fhirBundle: Bundle<Resource>): Bundle<Resource> {
  const normalizedBundle: Bundle = cloneDeep(fhirBundle);
  const resourceArrays = extractFhirTypesFromBundle(normalizedBundle);
  const normalizedCoverages = normalizeCoverages(resourceArrays.coverages);
  resourceArrays.coverages = normalizedCoverages;

  const normalizedVitalsObservations = normalizeObservations(resourceArrays.observationVitals);
  resourceArrays.observationVitals = normalizedVitalsObservations;

  const normalizedConditions = normalizeConditions(resourceArrays.conditions);
  resourceArrays.conditions = normalizedConditions;

  const validEncounters = filterInvalidEncounters(
    resourceArrays.encounters,
    resourceArrays.locations
  );
  resourceArrays.encounters = validEncounters;

  normalizedBundle.entry = Object.entries(resourceArrays).flatMap(([, resources]) => {
    const entriesArray = Array.isArray(resources) ? resources : [resources];
    return entriesArray.flatMap(v => buildCompleteBundleEntry(v, normalizedBundle.type) || []);
  });

  return sortCodings(normalizedBundle);
}
