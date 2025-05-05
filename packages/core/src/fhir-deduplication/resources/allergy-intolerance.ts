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
  deduplicateWithinMap,
  isUnknownCoding,
  unknownCode,
  fetchCodingCodeOrDisplayOrSystem,
} from "../shared";

const blacklistedSubstanceDisplays = ["no known allergies", "nka", "unknown"];

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
  refReplacementMap: Map<string, string>;
  danglingReferences: Set<string>;
} {
  const allergiesMap = new Map<string, AllergyIntolerance>();
  const refReplacementMap = new Map<string, string>();
  const danglingReferences = new Set<string>();

  const blacklistedAllergies: AllergyIntolerance[] = [];
  const validAllergies: AllergyIntolerance[] = [];

  for (const allergy of allergies) {
    if (allergy.reaction?.every(reaction => isUnknownAllergy(reaction.substance))) {
      blacklistedAllergies.push(allergy);
    } else {
      validAllergies.push(allergy);
    }
  }

  const hasValidAllergies = validAllergies.length > 0;

  if (hasValidAllergies) {
    for (const allergy of validAllergies) {
      const { allergy: newAllergy, substance } = preprocess(allergy);
      if (substance) {
        const key = JSON.stringify({ substance });
        deduplicateWithinMap(
          allergiesMap,
          key,
          newAllergy,
          refReplacementMap,
          undefined,
          undefined,
          postProcessAllergy
        );
      } else {
        danglingReferences.add(createRef(allergy));
      }
    }
    for (const allergy of blacklistedAllergies) {
      danglingReferences.add(createRef(allergy));
    }
  } else if (blacklistedAllergies.length > 0) {
    const allergy = findAllergyWithLongestSubstanceText(blacklistedAllergies);

    if (allergy) {
      const key = JSON.stringify({ allergy });
      // no post processing so we dont remove the unknown allergy
      deduplicateWithinMap(allergiesMap, key, allergy, refReplacementMap, undefined);

      const index = blacklistedAllergies.indexOf(allergy);
      if (index !== -1) {
        blacklistedAllergies.splice(index, 1);
      }

      for (const remainingAllergy of blacklistedAllergies) {
        danglingReferences.add(createRef(remainingAllergy));
      }
    }
  }

  return {
    allergiesMap,
    refReplacementMap,
    danglingReferences,
  };
}

function preprocess(allergy: AllergyIntolerance): {
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

function postProcessAllergy(allergy: AllergyIntolerance): AllergyIntolerance {
  const { allergy: newAllergy } = preprocess(allergy);
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

function isKnownAllergy(coding: Coding, text?: string | undefined): boolean {
  if (isUnknownCoding(coding)) return false;

  const code = fetchCodingCodeOrDisplayOrSystem(coding, "code");
  const display = fetchCodingCodeOrDisplayOrSystem(coding, "display");

  let isValid = false;
  if (code) isValid = true;
  if (display && !isUnknownAllergyText(display)) isValid = true;
  if (text && !isUnknownAllergyText(text)) isValid = true;
  return isValid;
}

function isUnknownAllergy(substance: CodeableConcept | undefined): boolean {
  if (!substance) return false;

  const { text, coding } = substance;

  if (text && isUnknownAllergyText(text)) {
    return true;
  }

  if (
    coding?.some(coding => {
      const display = fetchCodingCodeOrDisplayOrSystem(coding, "display");
      return isUnknownAllergyText(display);
    })
  ) {
    return true;
  }

  return false;
}

function isUnknownAllergyText(text: string | undefined) {
  return text && blacklistedSubstanceDisplays.includes(text.trim().toLowerCase());
}

function isKnownManifestation(concept: CodeableConcept) {
  if (_.isEqual(concept, unknownCode)) return false;

  const knownCoding = concept.coding?.filter(e => !isUnknownCoding(e));
  if (knownCoding?.length) return true;
  return false;
}

function findAllergyWithLongestSubstanceText(
  allergies: AllergyIntolerance[]
): AllergyIntolerance | undefined {
  return allergies.reduce((longest, current) => {
    const longestText = longest.reaction?.[0]?.substance?.text;
    const currentText = current.reaction?.[0]?.substance?.text;
    return (currentText?.length || 0) > (longestText?.length || 0) ? current : longest;
  });
}
