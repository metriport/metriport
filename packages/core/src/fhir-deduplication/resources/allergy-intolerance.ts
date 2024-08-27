import {
  AllergyIntolerance,
  AllergyIntoleranceReaction,
  CodeableConcept,
  Coding,
} from "@medplum/fhirtypes";
import _, { cloneDeep } from "lodash";
import { noKnownAllergiesSubstance } from "../__tests__/examples/allergy-examples";
import { combineResources, fillMaps, isKnownCoding } from "../shared";
import { unknownCode } from "./observation-shared";

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
    const { allergy: newAllergy, substance } = preProcess(allergy);
    if (substance) {
      const key = JSON.stringify({ substance });
      fillMaps(allergiesMap, key, newAllergy, refReplacementMap, undefined, postProcess);
    }
  }

  return {
    allergiesMap,
    refReplacementMap,
  };
}

function preProcess(allergy: AllergyIntolerance): {
  allergy: AllergyIntolerance;
  substance?: CodeableConcept;
} {
  const newAllergy = cloneDeep(allergy);
  const { substance, manifestations } = extractFromReactions(newAllergy.reaction);
  if (!substance) return { allergy: newAllergy };
  if (substance && manifestations) {
    newAllergy.reaction = [
      {
        ...newAllergy.reaction?.[0],
        substance,
        manifestation: manifestations,
      },
    ];
  }

  if (_.isEmpty(substance)) delete newAllergy.reaction?.[0]?.substance;
  if (!manifestations.length) delete newAllergy.reaction?.[0]?.manifestation;
  return { allergy: newAllergy, substance };
}

function postProcess(allergy: AllergyIntolerance): AllergyIntolerance {
  const { allergy: newAllergy } = preProcess(allergy);
  return newAllergy;
}

export function extractFromReactions(reactions: AllergyIntoleranceReaction[] | undefined): {
  substance: CodeableConcept | undefined;
  manifestations: CodeableConcept[];
} {
  const substance: CodeableConcept = {};
  const substances = new Set<Coding>();
  const manifestations = new Set<CodeableConcept>();

  reactions?.forEach(reaction => {
    if (reaction.substance) {
      reaction.substance.coding?.forEach(sub => {
        if (
          isKnownAllergy(sub) &&
          ![...substances].some(existingSub => _.isEqual(existingSub, sub))
        ) {
          substances.add(sub);
        }
      });
      if (reaction.substance.text) substance.text = reaction.substance.text;
      if (substances.size > 0) substance.coding = [...substances];
    }

    reaction.manifestation?.forEach(manif => {
      if (
        isKnownManifestation(manif) &&
        ![...manifestations].some(existingManif => _.isEqual(existingManif, manif))
      ) {
        manifestations.add(manif);
      }
    });
  });

  return {
    substance: _.isEmpty(substance) ? undefined : substance,
    manifestations: Array.from(manifestations),
  };
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
