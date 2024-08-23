import { AllergyIntolerance } from "@medplum/fhirtypes";
import { combineResources, fillMaps } from "../shared";

export function deduplicateAllergyIntolerances(allergies: AllergyIntolerance[]) {
  const { allergiesMap, refReplacementMap } = groupSameAllergies(allergies);
  return {
    combinedAllergies: combineResources({
      combinedMaps: [allergiesMap],
    }),
    refReplacementMap,
  };
}

/**
 * Approach:
 * 1 map, where the key is made of:
 * - reaction substance
 *
 * We want to remove "unknown" substances and manifestations in the process
 */
export function groupSameAllergies(allergies: AllergyIntolerance[]): {
  allergiesMap: Map<string, AllergyIntolerance>;
  refReplacementMap: Map<string, string[]>;
} {
  const allergiesMap = new Map<string, AllergyIntolerance>();
  const refReplacementMap = new Map<string, string[]>();

  for (const allergy of allergies) {
    const reaction = allergy.reaction;

    if (reaction) {
      const key = JSON.stringify({ reaction });
      fillMaps(allergiesMap, key, allergy, refReplacementMap);
    }
  }

  return {
    allergiesMap,
    refReplacementMap,
  };
}
