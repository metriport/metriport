import { CodeableConcept, Immunization } from "@medplum/fhirtypes";
import { CVX_CODE, CVX_OID, NDC_CODE, NDC_OID } from "../../util/constants";
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
  pickMostDescriptiveStatus,
} from "../shared";

const immunizationStatus = ["entered-in-error", "completed", "not-done"] as const;

export type ImmunizationStatus = (typeof immunizationStatus)[number];

export const statusRanking: Record<ImmunizationStatus, number> = {
  "entered-in-error": 0,
  "not-done": 1,
  completed: 2,
};

export function deduplicateImmunizations(
  immunizations: Immunization[]
): DeduplicationResult<Immunization> {
  const { immunizationsMap, refReplacementMap, danglingReferences } =
    groupSameImmunizations(immunizations);
  return {
    combinedResources: combineResources({
      combinedMaps: [immunizationsMap],
    }),
    refReplacementMap,
    danglingReferences,
  };
}

/**
 * Approach:
 * 1 map, where the key is made of:
 * - vaccineCode (ndcCode, cvxCode, display)
 * - date (occurenceDateTime or occurenceString)
 */
export function groupSameImmunizations(immunizations: Immunization[]): {
  immunizationsMap: Map<string, Immunization>;
  refReplacementMap: Map<string, string>;
  danglingReferences: Set<string>;
} {
  const l1ImmunizationsMap = new Map<string, string>();
  const l2ImmunizationsMap = new Map<string, Immunization>();

  const refReplacementMap = new Map<string, string>();
  const danglingReferences = new Set<string>();

  function assignMostDescriptiveStatus(
    master: Immunization,
    existing: Immunization,
    target: Immunization
  ): Immunization {
    master.status = pickMostDescriptiveStatus(statusRanking, existing.status, target.status);
    return master;
  }

  for (const immunization of immunizations) {
    if (hasBlacklistedText(immunization.vaccineCode)) {
      danglingReferences.add(createRef(immunization));
      continue;
    }

    const date = getDateFromResource(immunization, "datetime");

    const { cvxCode, ndcCode } = extractCodes(immunization.vaccineCode);
    const display = extractDisplayFromConcept(immunization.vaccineCode);

    const identifiers = [
      ...(cvxCode ? [{ cvxCode }] : []),
      ...(ndcCode ? [{ ndcCode }] : []),
      ...(display ? [{ displayCode: display }] : []),
    ];
    const hasIdentifier = identifiers.length > 0;

    if (!hasIdentifier) {
      danglingReferences.add(createRef(immunization));
      continue;
    }
    const getterKeys: string[] = [];
    const setterKeys: string[] = [];

    if (date) {
      // keys that match a code + date together
      setterKeys.push(...createKeysFromObjectArray({ date }, identifiers));
      getterKeys.push(...createKeysFromObjectArray({ date }, identifiers));

      // flagging the vaccine to indicate having a date
      setterKeys.push(...createKeysFromObjectArrayAndBits(identifiers, [1]));

      // can dedup with a vaccine that has no date, as long as an identifier matches
      getterKeys.push(...createKeysFromObjectArrayAndBits(identifiers, [0]));
    } else {
      // flagging the vaccine to indicate not having a date
      setterKeys.push(...createKeysFromObjectArrayAndBits(identifiers, [0]));

      // can dedup with a vaccine that does or does not have a date
      getterKeys.push(...createKeysFromObjectArrayAndBits(identifiers, [0]));
      getterKeys.push(...createKeysFromObjectArrayAndBits(identifiers, [1]));
    }

    if (setterKeys.length > 0) {
      fillL1L2Maps({
        map1: l1ImmunizationsMap,
        map2: l2ImmunizationsMap,
        getterKeys,
        setterKeys,
        targetResource: immunization,
        refReplacementMap,
        applySpecialModifications: assignMostDescriptiveStatus,
      });
    } else {
      danglingReferences.add(createRef(immunization));
    }
  }

  return {
    immunizationsMap: l2ImmunizationsMap,
    refReplacementMap,
    danglingReferences,
  };
}

export function extractCodes(concept: CodeableConcept | undefined): {
  cvxCode: string | undefined;
  ndcCode: string | undefined;
} {
  let cvxCode = undefined;
  let ndcCode = undefined;
  if (!concept) return { cvxCode, ndcCode };

  if (concept && concept.coding) {
    for (const coding of concept.coding) {
      const system = fetchCodingCodeOrDisplayOrSystem(coding, "system");
      const code = fetchCodingCodeOrDisplayOrSystem(coding, "code");
      if (system && code) {
        if (system.includes(CVX_CODE) || system.includes(CVX_OID)) {
          cvxCode = code;
        } else if (system.includes(NDC_CODE) || system.includes(NDC_OID)) {
          ndcCode = code;
        }
      }
    }
  }
  return { cvxCode, ndcCode };
}
