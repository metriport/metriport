import { RXNORM_URL, SNOMED_URL } from "../../../medical/fhir/constants";

export interface Coding {
  system?: string;
  code?: string;
  display?: string;
}

export interface CodeableConcept {
  coding?: Coding[];
  text?: string;
}

import {
  drugClassEntries,
  environmentalFoodAllergenTextMap,
  rxNormCodeToTextMap,
} from "./allergy-data-map";

// Build lookup sets for SNOMED codes (drug classes)
const snomedProductCodes = new Set<string>();
const snomedSubstanceCodes = new Set<string>();

for (const entry of drugClassEntries) {
  if (entry.snomedCtProductCode) snomedProductCodes.add(entry.snomedCtProductCode);
  if (entry.snomedCtSubstanceCode) snomedSubstanceCodes.add(entry.snomedCtSubstanceCode);
}

// Build combined lookup map: code -> Practice Fusion expected text
const allergenCodeToTextMap = new Map<string, string>();

// Add drug class entries (SNOMED codes)
for (const entry of drugClassEntries) {
  if (entry.snomedCtProductCode) {
    allergenCodeToTextMap.set(entry.snomedCtProductCode, entry.allergyClassName);
  }
  if (entry.snomedCtSubstanceCode) {
    allergenCodeToTextMap.set(entry.snomedCtSubstanceCode, entry.allergyClassName);
  }
}

// Add environmental/food allergen SNOMED codes
for (const [code, text] of Object.entries(environmentalFoodAllergenTextMap)) {
  allergenCodeToTextMap.set(code, text);
}

/**
 * Creates CodeableConcept matching by a specific text
 * that's accepted by Practice Fusion.
 *
 * @param codeableConcept - The code field from AllergyIntolerance
 * @returns A new CodeableConcept with the correct text, or undefined if no match
 */
export function createPracticeFusionCodeableConcept(
  codeableConcept: CodeableConcept | undefined
): CodeableConcept | undefined {
  if (!codeableConcept?.coding) return undefined;

  for (const coding of codeableConcept.coding) {
    const code = coding.code;
    if (!code) continue;
    if (coding.system === SNOMED_URL) {
      const text = allergenCodeToTextMap.get(code);
      if (text) {
        return {
          ...codeableConcept,
          text,
        };
      }
    }
    if (coding.system === RXNORM_URL) {
      const text = rxNormCodeToTextMap[code];
      if (text) {
        return {
          ...codeableConcept,
          text,
        };
      }
    }
  }
  return undefined;
}
