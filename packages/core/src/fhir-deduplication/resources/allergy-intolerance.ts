import {
  AllergyIntolerance,
  AllergyIntoleranceReaction,
  CodeableConcept,
  Coding,
} from "@medplum/fhirtypes";
import { noKnownAllergiesSubstance } from "../__tests__/examples/allergy-examples";
import { combineResources, fillMaps } from "../shared";
import { unknownCode } from "./observation-shared";
import _ from "lodash";

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
 * - reaction manifestation (optional)
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
    const { substances, manifestations } = extractFromReactions(allergy.reaction);

    if (substances.length || manifestations.length) {
      const key = JSON.stringify({ substances, manifestations });
      fillMaps(allergiesMap, key, allergy, refReplacementMap);
    }
  }

  return {
    allergiesMap,
    refReplacementMap,
  };
}

export function extractFromReactions(reactions: AllergyIntoleranceReaction[] | undefined): {
  substances: Coding[];
  manifestations: CodeableConcept[];
} {
  const substances: Coding[] = [];
  const manifestations: CodeableConcept[] = [];

  reactions?.flatMap(reaction => {
    const knownSubstances = reaction.substance?.coding?.filter(isKnownAllergy);
    if (knownSubstances) substances?.push(...knownSubstances);

    const knownManifestations = reaction.manifestation?.filter(isKnownManifestation);
    if (knownManifestations) manifestations?.push(...knownManifestations);
  });

  return { substances, manifestations };
}

function isKnownAllergy(coding: Coding) {
  if (_.isEqual(coding, noKnownAllergiesSubstance)) return false;

  const code = coding.code?.trim().toLowerCase();
  const system = coding.system?.trim().toLowerCase();
  const display = coding.display?.trim().toLowerCase();
  if (!code || !system || display === "no known allergies") return false;
  return true;
}

function isKnownManifestation(concept: CodeableConcept) {
  if (_.isEqual(concept, unknownCode)) return false;

  const knownCoding = concept.coding?.filter(isKnownCoding);
  if (knownCoding?.length) return true;
  return false;
}

function isKnownCoding(coding: Coding) {
  const code = coding.code?.trim().toLowerCase();
  const system = coding.system?.trim().toLowerCase();
  const display = coding.display?.trim().toLowerCase();
  if (code === "unk" || system?.includes("unknown") || display === "unknown") {
    return false;
  }
  return true;
}
