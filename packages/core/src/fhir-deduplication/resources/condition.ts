import { CodeableConcept, Condition } from "@medplum/fhirtypes";
import {
  ICD_10_CODE,
  ICD_10_OID,
  SNOMED_CODE,
  SNOMED_OID,
  combineTwoResources,
  createCompositeKey,
  getDateFromString,
} from "../shared";

/**
 * Approach:
 * 1. Group same Conditions based on:
 *      - Medical codes:
 *          - ICD-10, if possible
 *          // TODO: Introduce SNOMED cross-walk to match SNOMED with ICD-10
 *          - SNOMED, if possible
 *      - Date
 * 2. Combine the Conditions in each group into one master condition and return the array of only unique and maximally filled out Conditions
 */
export function deduplicateConditions(conditions: Condition[]) {
  const { snomedMap, icd10Map, remainingConditions } = groupSameConditions(conditions);
  return combineConditions(snomedMap, icd10Map, remainingConditions);
}

export function groupSameConditions(conditions: Condition[]): {
  icd10Map: Map<string, Condition>;
  snomedMap: Map<string, Condition>;
  remainingConditions: Condition[];
} {
  const snomedMap = new Map<string, Condition>();
  const icd10Map = new Map<string, Condition>();
  const remainingConditions: Condition[] = [];

  for (const condition of conditions) {
    const date = createDateKey(condition);
    const { snomedCode, icd10Code } = extractCodes(condition.code);

    if (icd10Code) {
      const compKey = JSON.stringify(createCompositeKey(icd10Code, date));
      const existingCondition = icd10Map.get(compKey);
      if (existingCondition) {
        const mergedCondition = combineTwoResources(existingCondition, condition);
        icd10Map.set(compKey, mergedCondition);
      } else {
        icd10Map.set(compKey, condition);
      }
    } else if (snomedCode) {
      const compKey = JSON.stringify(createCompositeKey(snomedCode, date));
      const existingCondition = snomedMap.get(compKey);
      if (existingCondition) {
        const mergedCondition = combineTwoResources(existingCondition, condition);
        snomedMap.set(compKey, mergedCondition);
      } else {
        snomedMap.set(compKey, condition);
      }
    } else {
      remainingConditions.push(condition);
    }
  }

  return { icd10Map, snomedMap, remainingConditions };
}

export function createDateKey(condition: Condition): string | undefined {
  if (condition.onsetPeriod?.start) {
    return getDateFromString(condition.onsetPeriod?.start);
  } else if (condition.onsetDateTime) {
    return getDateFromString(condition.onsetDateTime);
  }

  return undefined;
}

export function extractCodes(concept: CodeableConcept | undefined): {
  snomedCode: string | undefined;
  icd10Code: string | undefined;
} {
  let snomedCode = undefined;
  let icd10Code = undefined;
  if (!concept) return { snomedCode, icd10Code };

  if (concept && concept.coding) {
    for (const coding of concept.coding) {
      const system = coding.system?.toLowerCase();
      const code = coding.code?.trim().toLowerCase();
      if (system && code) {
        if (system.includes(SNOMED_CODE) || system.includes(SNOMED_OID)) {
          snomedCode = code;
        } else if (system.includes(ICD_10_CODE) || system.includes(ICD_10_OID)) {
          icd10Code = code;
        }
      }
    }
  }
  return { snomedCode, icd10Code };
}

export function combineConditions(
  snomedMap: Map<string, Condition>,
  icd10Map: Map<string, Condition>,
  remainingConditions: Condition[]
): Condition[] {
  const combinedConditions: Condition[] = [];
  for (const condition of icd10Map.values()) {
    combinedConditions.push(condition);
  }
  for (const condition of snomedMap.values()) {
    combinedConditions.push(condition);
  }
  combinedConditions.push(...remainingConditions);
  return combinedConditions;
}
