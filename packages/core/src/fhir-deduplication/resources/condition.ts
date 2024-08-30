import { CodeableConcept, Condition } from "@medplum/fhirtypes";
import { ICD_10_CODE, ICD_10_OID, SNOMED_CODE, SNOMED_OID } from "../../util/constants";
import {
  combineResources,
  createRef,
  fillMaps,
  getDateFromResource,
  hasBlacklistedText,
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
  const { snomedMap, icd10Map, refReplacementMap, danglingReferences } =
    groupSameConditions(conditions);
  return {
    combinedConditions: combineResources({
      combinedMaps: [snomedMap, icd10Map],
    }),
    refReplacementMap,
    danglingReferences,
  };
}

export function groupSameConditions(conditions: Condition[]): {
  snomedMap: Map<string, Condition>;
  icd10Map: Map<string, Condition>;
  refReplacementMap: Map<string, string[]>;
  danglingReferences: string[];
} {
  const snomedMap = new Map<string, Condition>();
  const icd10Map = new Map<string, Condition>();
  const refReplacementMap = new Map<string, string[]>();
  const danglingReferencesSet = new Set<string>();

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
    if (hasBlacklistedText(condition.code)) {
      danglingReferencesSet.add(createRef(condition));
      continue;
    }

    const date = getDateFromResource(condition);
    const { snomedCode, icd10Code } = extractCodes(condition.code);

    if (icd10Code && date) {
      const compKey = JSON.stringify({ icd10Code, date });
      fillMaps(icd10Map, compKey, condition, refReplacementMap, undefined, removeOtherCodes);
    } else if (snomedCode && date) {
      const compKey = JSON.stringify({ snomedCode, date });
      fillMaps(snomedMap, compKey, condition, refReplacementMap, undefined, removeOtherCodes);
    } else {
      danglingReferencesSet.add(createRef(condition));
    }
  }

  return { snomedMap, icd10Map, refReplacementMap, danglingReferences: [...danglingReferencesSet] };
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
