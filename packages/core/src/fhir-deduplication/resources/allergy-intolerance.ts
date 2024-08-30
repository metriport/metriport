import {
  AllergyIntolerance,
  AllergyIntoleranceReaction,
  CodeableConcept,
  Coding,
} from "@medplum/fhirtypes";
import _, { cloneDeep } from "lodash";
import { combineResources, createRef, fillMaps, hasBlacklistedText } from "../shared";
import { isUnknownCoding, unknownCode } from "./observation-shared";

export function deduplicateAllergyIntolerances(allergies: AllergyIntolerance[]) {
  const { allergiesMap, refReplacementMap, danglingReferences } = groupSameAllergies(allergies);
  return {
    combinedAllergies: combineResources({
      combinedMaps: [allergiesMap],
    }),
    refReplacementMap,
    danglingReferences,
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
  danglingReferences: string[];
} {
  const allergiesMap = new Map<string, AllergyIntolerance>();
  const refReplacementMap = new Map<string, string[]>();
  const danglingReferencesSet = new Set<string>();

  for (const allergy of allergies) {
    if (allergy.reaction?.some(reaction => hasBlacklistedText(reaction.substance))) {
      danglingReferencesSet.add(createRef(allergy));
      continue;
    }

    const { allergy: newAllergy, substance } = preProcess(allergy);
    if (substance) {
      const key = JSON.stringify({ substance });
      fillMaps(allergiesMap, key, newAllergy, refReplacementMap, undefined, postProcess);
    } else {
      danglingReferencesSet.add(createRef(allergy));
    }
  }

  return {
    allergiesMap,
    refReplacementMap,
    danglingReferences: [...danglingReferencesSet],
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
  if (isUnknownCoding(coding)) return false;

  const code = coding.code?.trim().toLowerCase();
  const system = coding.system?.trim().toLowerCase();
  const display = coding.display?.trim().toLowerCase();
  if (!code || !system || display === "no known allergies") return false;
  return true;
}

function isKnownManifestation(concept: CodeableConcept) {
  if (_.isEqual(concept, unknownCode)) return false;

  const knownCoding = concept.coding?.filter(e => !isUnknownCoding(e));
  if (knownCoding?.length) return true;
  return false;
}
