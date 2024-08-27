import { CodeableConcept, Condition } from "@medplum/fhirtypes";
import { ICD_10_CODE, ICD_10_OID, SNOMED_CODE, SNOMED_OID } from "../../util/constants";
import { combineResources, createCompositeKey, fillMaps, getDateFromResource } from "../shared";

const genericSnomedProblemCode = "55607006";

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
  const { snomedMap, icd10Map, refReplacementMap } = groupSameConditions(conditions);
  return {
    combinedConditions: combineResources({
      combinedMaps: [snomedMap, icd10Map],
    }),
    refReplacementMap,
  };
}

function isBlacklistedCondition(condition: Condition): boolean {
  const { snomedCode } = extractCodes(condition.code);
  const blacklistCodes = [genericSnomedProblemCode];
  return blacklistCodes.includes(snomedCode ?? "");
}

export function groupSameConditions(conditions: Condition[]): {
  snomedMap: Map<string, Condition>;
  icd10Map: Map<string, Condition>;
  refReplacementMap: Map<string, string[]>;
} {
  const snomedMap = new Map<string, Condition>();
  const icd10Map = new Map<string, Condition>();
  const refReplacementMap = new Map<string, string[]>();

  function removeOtherCodes(master: Condition): Condition {
    const code = master.code;
    const filtered = code?.coding?.filter(
      coding =>
        coding.system?.includes(SNOMED_CODE) ||
        coding.system?.includes(SNOMED_OID) ||
        coding.system?.includes(ICD_10_CODE) ||
        coding.system?.includes(ICD_10_OID)
    );
    if (filtered) {
      master.code = {
        ...code,
        coding: filtered,
      };
    }
    return master;
  }

  for (const condition of conditions) {
    if (isBlacklistedCondition(condition)) {
      continue;
    }
    const date = getDateFromResource(condition);
    const { snomedCode, icd10Code } = extractCodes(condition.code);

    if (icd10Code && date) {
      const compKey = JSON.stringify(createCompositeKey(icd10Code, date));
      fillMaps(icd10Map, compKey, condition, refReplacementMap, undefined, removeOtherCodes);
    } else if (snomedCode && date) {
      const compKey = JSON.stringify(createCompositeKey(snomedCode, date));
      fillMaps(snomedMap, compKey, condition, refReplacementMap, undefined, removeOtherCodes);
    }
  }

  return { snomedMap, icd10Map, refReplacementMap };
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
