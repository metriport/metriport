import { CodeableConcept, Condition } from "@medplum/fhirtypes";
import { ICD_10_CODE, ICD_10_OID, SNOMED_CODE, SNOMED_OID, ICD_9_CODE } from "../../util/constants";
import {
  DeduplicationResult,
  combineResources,
  createRef,
  extractDisplayFromConcept,
  fillMaps,
  getDateFromResource,
  hasBlacklistedText,
  isUnknownCoding,
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
export function deduplicateConditions(conditions: Condition[]): DeduplicationResult<Condition> {
  const { snomedMap, icd10Map, displayMap, refReplacementMap, danglingReferences } =
    groupSameConditions(conditions);
  return {
    combinedResources: combineResources({
      combinedMaps: [snomedMap, icd10Map, displayMap],
    }),
    refReplacementMap,
    danglingReferences,
  };
}

export function groupSameConditions(conditions: Condition[]): {
  snomedMap: Map<string, Condition>;
  icd10Map: Map<string, Condition>;
  displayMap: Map<string, Condition>;
  refReplacementMap: Map<string, string>;
  danglingReferences: Set<string>;
} {
  const snomedMap = new Map<string, Condition>();
  const icd10Map = new Map<string, Condition>();
  const displayMap = new Map<string, Condition>();
  const refReplacementMap = new Map<string, string>();
  const danglingReferences = new Set<string>();

  function removeOtherCodes(master: Condition): Condition {
    const code = master.code;
    const filtered = code?.coding?.filter(coding => {
      const system = coding.system?.toLowerCase();
      return (
        system?.includes(SNOMED_CODE) ||
        system?.includes(SNOMED_OID) ||
        system?.includes(ICD_10_CODE) ||
        system?.includes(ICD_10_OID) ||
        system?.includes(ICD_9_CODE)
      );
    });
    if (filtered && filtered.length > 0) {
      master.code = {
        ...code,
        coding: filtered,
      };
    } else {
      master.code = { ...code };
      delete master.code.coding;
    }
    return master;
  }

  for (const condition of conditions) {
    if (hasBlacklistedText(condition.code) || !isKnownCondition(condition.code)) {
      danglingReferences.add(createRef(condition));
      continue;
    }

    const date = getDateFromResource(condition);
    if (!date) {
      danglingReferences.add(createRef(condition));
      continue;
    }

    const { snomedCode, icd10Code } = extractCodes(condition.code);
    if (icd10Code) {
      const compKey = JSON.stringify({ icd10Code, date });
      fillMaps(icd10Map, compKey, condition, refReplacementMap, undefined, removeOtherCodes);
    } else if (snomedCode) {
      const compKey = JSON.stringify({ snomedCode, date });
      fillMaps(snomedMap, compKey, condition, refReplacementMap, undefined, removeOtherCodes);
    } else {
      const display = extractDisplayFromConcept(condition.code);
      if (display) {
        const compKey = JSON.stringify({ display, date });
        fillMaps(displayMap, compKey, condition, refReplacementMap, undefined);
      } else {
        danglingReferences.add(createRef(condition));
      }
    }
  }

  return {
    snomedMap,
    icd10Map,
    displayMap,
    refReplacementMap,
    danglingReferences,
  };
}

function isKnownCondition(concept: CodeableConcept | undefined) {
  const knownCodings = concept?.coding?.filter(
    coding =>
      !isUnknownCoding(coding) &&
      (coding.code !== "55607006" || coding.display?.toLowerCase().trim() !== "problem")
  );

  return knownCodings?.length && knownCodings?.length > 0;
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
