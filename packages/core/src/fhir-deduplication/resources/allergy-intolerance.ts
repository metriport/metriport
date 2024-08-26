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

  function postProcess(master: AllergyIntolerance): AllergyIntolerance {
    const { substances, manifestations } = extractFromReactions(master.reaction);
    if (substances && manifestations) {
      master.reaction = [
        {
          substance: {
            coding: substances,
          },
          manifestation: manifestations,
        },
      ];
    }

    return master;
  }

  for (const allergy of allergies) {
    const { substances } = extractFromReactions(allergy.reaction);

    if (substances.length) {
      const key = JSON.stringify({ substances });
      fillMaps(allergiesMap, key, allergy, refReplacementMap, undefined, postProcess);
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
  const substances = new Set<Coding>();
  const manifestations = new Set<CodeableConcept>();

  reactions?.forEach(reaction => {
    reaction.substance?.coding?.forEach(sub => {
      if (
        isKnownAllergy(sub) &&
        ![...substances].some(existingSub => _.isEqual(existingSub, sub))
      ) {
        substances.add(sub);
      }
    });

    reaction.manifestation?.forEach(manif => {
      if (
        isKnownManifestation(manif) &&
        ![...manifestations].some(existingManif => _.isEqual(existingManif, manif))
      ) {
        manifestations.add(manif);
      }
    });
  });

  return { substances: Array.from(substances), manifestations: Array.from(manifestations) };
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
