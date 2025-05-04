import { CodeableConcept, Condition } from "@medplum/fhirtypes";
import { ICD_10_CODE, ICD_10_OID, ICD_9_CODE, SNOMED_CODE, SNOMED_OID } from "../../util/constants";
import {
  DeduplicationResult,
  combineResources,
  createKeysFromObjectArray,
  createKeysFromObjectArrayAndBits,
  createRef,
  extractDisplayFromConcept,
  fetchCodingCodeOrDisplayOrSystem,
  fillL1L2Maps,
  getDateFromResource,
  hasBlacklistedText,
  isUnknownCoding,
} from "../shared";

/**
 * Approach:
 * 1. Group same Conditions based on:
 *      - Medical codes:
 *          - ICD-10
 *          - SNOMED
 *          - ICD-9
 *      - Date
 *      - Condition name (from code->text or coding->display)
 * 2. Combine the Conditions in each group into one master condition and return the array of only unique and maximally filled out Conditions
 */
export function deduplicateConditions(
  conditions: Condition[],
  isExtensionIncluded = true
): DeduplicationResult<Condition> {
  const { conditionsMap, refReplacementMap, danglingReferences } = groupSameConditions(
    conditions,
    isExtensionIncluded
  );
  return {
    combinedResources: combineResources({
      combinedMaps: [conditionsMap],
    }),
    refReplacementMap,
    danglingReferences,
  };
}

export function groupSameConditions(
  conditions: Condition[],
  isExtensionIncluded: boolean
): {
  conditionsMap: Map<string, Condition>;
  refReplacementMap: Map<string, string>;
  danglingReferences: Set<string>;
} {
  const l1ConditionsMap = new Map<string, string>();
  const l2ConditionsMap = new Map<string, Condition>();

  const refReplacementMap = new Map<string, string>();
  const danglingReferences = new Set<string>();

  for (const condition of conditions) {
    if (hasBlacklistedText(condition.code) || !isKnownCondition(condition.code)) {
      danglingReferences.add(createRef(condition));
      continue;
    }

    const date = getDateFromResource(condition);
    const { snomedCode, icd10Code } = extractCodes(condition.code);
    const display = extractDisplayFromConcept(condition.code);

    const identifiers = [
      ...(snomedCode ? [{ snomedCode }] : []),
      ...(icd10Code ? [{ icd10Code }] : []),
      ...(display ? [{ display }] : []),
    ];
    const hasIdentifier = identifiers.length > 0;

    if (!hasIdentifier) {
      danglingReferences.add(createRef(condition));
      continue;
    }
    const getterKeys: string[] = [];
    const setterKeys: string[] = [];

    if (date) {
      // flagging the condition with each unique identifier + date
      setterKeys.push(...createKeysFromObjectArray({ date }, identifiers));
      // flagging the condition with each unique identifier + 1 date bit
      setterKeys.push(...createKeysFromObjectArrayAndBits(identifiers, [1]));

      // the condition will dedup using each unique identifier with the same date,
      getterKeys.push(...createKeysFromObjectArray({ date }, identifiers));
      // the condition will dedup against ones that don't have the date
      getterKeys.push(...createKeysFromObjectArrayAndBits(identifiers, [0]));
    }

    if (!date) {
      // flagging the condition with each unique identifier + 0 date bit
      setterKeys.push(...createKeysFromObjectArrayAndBits(identifiers, [0]));

      // the condition will dedup against ones that might or might not have the date
      getterKeys.push(...createKeysFromObjectArrayAndBits(identifiers, [0]));
      getterKeys.push(...createKeysFromObjectArrayAndBits(identifiers, [1]));
    }

    if (setterKeys.length > 0) {
      fillL1L2Maps({
        map1: l1ConditionsMap,
        map2: l2ConditionsMap,
        getterKeys,
        setterKeys,
        targetResource: condition,
        refReplacementMap,
        onPostmerge: removeOtherCodes,
        isExtensionIncluded,
      });
    } else {
      danglingReferences.add(createRef(condition));
    }
  }

  return {
    conditionsMap: l2ConditionsMap,
    refReplacementMap,
    danglingReferences,
  };
}

export function createKeyWithBits(
  object: object,
  date: string | undefined,
  dateBit: number
): string {
  const keyObject = { ...object, date: dateBit === 1 ? date : undefined, dateBit };
  return JSON.stringify(keyObject);
}

function isKnownCondition(concept: CodeableConcept | undefined) {
  const knownCodings = concept?.coding?.filter(coding => {
    const code = fetchCodingCodeOrDisplayOrSystem(coding, "code");
    const display = fetchCodingCodeOrDisplayOrSystem(coding, "display");
    return !isUnknownCoding(coding) && (code !== "55607006" || display !== "problem");
  });

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
      const system = fetchCodingCodeOrDisplayOrSystem(coding, "system");
      const code = fetchCodingCodeOrDisplayOrSystem(coding, "code");
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

function removeOtherCodes(master: Condition): Condition {
  const code = master.code;
  const codings = code?.coding;
  if (!codings?.length) return master;

  // If the condition only has one coding that provides insight with the `display` field, let's keep it
  if (codings.length === 1 && codings[0]) {
    const display = fetchCodingCodeOrDisplayOrSystem(codings[0], "display");
    if (display) return master;
  }

  const filtered = codings.filter(coding => {
    const system = fetchCodingCodeOrDisplayOrSystem(coding, "system");
    return (
      system?.includes(SNOMED_CODE) ||
      system?.includes(SNOMED_OID) ||
      system?.includes(ICD_10_CODE) ||
      system?.includes(ICD_10_OID) ||
      system?.includes(ICD_9_CODE)
    );
  });

  if (filtered.length > 0) {
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
