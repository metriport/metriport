import {
  AllergyIntolerance,
  AllergyIntoleranceReaction,
  CodeableConcept,
  Coding,
} from "@medplum/fhirtypes";
import _, { cloneDeep } from "lodash";
import {
  DeduplicationResult,
  combineResources,
  createRef,
  fillMaps,
  hasBlacklistedText,
  isUnknownCoding,
  unknownCode,
} from "../shared";

export function deduplicateAllergyIntolerances(
  allergies: AllergyIntolerance[]
): DeduplicationResult<AllergyIntolerance> {
  const { allergiesMap, refReplacementMap, danglingReferences } = groupSameAllergies(allergies);
  return {
    combinedResources: combineResources({
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
          isKnownAllergy(sub, reaction.substance?.text) &&
          ![...substances].some(existingSub => _.isEqual(existingSub, sub))
        ) {
          substances.add(sub);
        }
      });
      if (reaction.substance.text && !isUnknownAllergyText(reaction.substance.text)) {
        substance.text = reaction.substance.text;
      }
      if (substances.size > 0) substance.coding = [...substances];
    }

    reaction.manifestation?.forEach(manif => {
      if (![...manifestations].some(existingManif => _.isEqual(existingManif, manif))) {
        manifestations.add(manif);
      }
    });
  });

  return {
    substance: _.isEmpty(substance) ? undefined : substance,
    manifestations: (() => {
      const knownManifestations = Array.from(manifestations).filter(isKnownManifestation);
      return knownManifestations.length > 0 ? knownManifestations : Array.from(manifestations);
    })(),
  };
}

const blacklistedSubstanceDisplays = ["no known allergies", "nka", "unknown"];
function isKnownAllergy(coding: Coding, text?: string | undefined) {
  if (isUnknownCoding(coding)) return false;

  const code = coding.code?.trim().toLowerCase();
  const display = coding.display?.trim().toLowerCase();

  let isValid = false;
  if (code) isValid = true;
  if (display && !isUnknownAllergyText(display)) isValid = true;
  if (text && !isUnknownAllergyText(text)) isValid = true;
  return isValid;
}

function isUnknownAllergyText(text: string | undefined) {
  return text && blacklistedSubstanceDisplays.includes(text.toLowerCase().trim());
}

function isKnownManifestation(concept: CodeableConcept) {
  if (_.isEqual(concept, unknownCode)) return false;

  const knownCoding = concept.coding?.filter(e => !isUnknownCoding(e));
  if (knownCoding?.length) return true;
  return false;
}
