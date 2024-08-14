import { CodeableConcept, Condition } from "@medplum/fhirtypes";
import {
  ICD_10_CODE,
  ICD_10_OID,
  SNOMED_CODE,
  SNOMED_OID,
  combineResources,
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
  const { snomedMap, icd10Map, remainingConditions, idReplacementMap } =
    groupSameConditions(conditions);
  return {
    combinedConditions: combineResources({
      combinedMaps: [snomedMap, icd10Map],
      remainingResources: remainingConditions,
    }),
    idReplacementMap,
  };
}

export function groupSameConditions(conditions: Condition[]): {
  snomedMap: Map<string, Condition>;
  icd10Map: Map<string, Condition>;
  remainingConditions: Condition[];
  idReplacementMap: Map<string, string[]>;
} {
  const snomedMap = new Map<string, Condition>();
  const icd10Map = new Map<string, Condition>();
  const remainingConditions: Condition[] = [];
  const idReplacementMap = new Map<string, string[]>();

  for (const condition of conditions) {
    const date = getDate(condition);
    const { snomedCode, icd10Code } = extractCodes(condition.code);

    if (icd10Code) {
      const compKey = JSON.stringify(createCompositeKey(icd10Code, date));
      const existingCondition = icd10Map.get(compKey);
      if (existingCondition?.id) {
        const mergedCondition = combineTwoResources(existingCondition, condition);
        icd10Map.set(compKey, mergedCondition);

        const existingReplacementIds = idReplacementMap.get(existingCondition.id);
        if (condition.id) {
          if (existingReplacementIds) {
            idReplacementMap.set(existingCondition.id, [...existingReplacementIds, condition.id]);
          } else {
            idReplacementMap.set(existingCondition.id, [condition.id]);
          }
        }
      } else {
        icd10Map.set(compKey, condition);
      }
    } else if (snomedCode) {
      const compKey = JSON.stringify(createCompositeKey(snomedCode, date));
      const existingCondition = snomedMap.get(compKey);
      if (existingCondition?.id) {
        const mergedCondition = combineTwoResources(existingCondition, condition);
        snomedMap.set(compKey, mergedCondition);

        const existingReplacementIds = idReplacementMap.get(existingCondition.id);
        if (condition.id) {
          if (existingReplacementIds) {
            idReplacementMap.set(existingCondition.id, [...existingReplacementIds, condition.id]);
          } else {
            idReplacementMap.set(existingCondition.id, [condition.id]);
          }
        }
      } else {
        snomedMap.set(compKey, condition);
      }
    } else {
      remainingConditions.push(condition);
    }
  }

  return { snomedMap, icd10Map, remainingConditions, idReplacementMap };
}

export function getDate(condition: Condition): string | undefined {
  if (condition.onsetPeriod?.start) {
    return getDateFromString(condition.onsetPeriod?.start);
  } else if (condition.onsetDateTime) {
    return getDateFromString(condition.onsetDateTime);
  } else if (condition.onsetAge?.value) {
    return condition.onsetAge.value.toString() + condition.onsetAge.unit;
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
