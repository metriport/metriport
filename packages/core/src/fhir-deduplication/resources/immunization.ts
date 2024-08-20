import { CodeableConcept, Immunization } from "@medplum/fhirtypes";
import { CVX_CODE, CVX_OID, NDC_CODE, NDC_OID } from "../../util/constants";
import {
  combineResources,
  fillMaps,
  getDateFromResource,
  pickMostDescriptiveStatus,
} from "../shared";

const immunizationStatus = ["entered-in-error", "completed", "not-done"] as const;

export type ImmunizationStatus = (typeof immunizationStatus)[number];

export const statusRanking = {
  "entered-in-error": 0,
  "not-done": 1,
  completed: 2,
};

export function deduplicateImmunizations(immunizations: Immunization[]): {
  combinedImmunizations: Immunization[];
  refReplacementMap: Map<string, string[]>;
} {
  const { immunizationsMap, refReplacementMap } = groupSameImmunizations(immunizations);
  return {
    combinedImmunizations: combineResources({
      combinedMaps: [immunizationsMap],
    }),
    refReplacementMap,
  };
}

/**
 * Approach:
 * 1 map, where the key is made of:
 * - date (occurenceDateTime or occurenceString)
 * - vaccineCode
 */
export function groupSameImmunizations(immunizations: Immunization[]): {
  immunizationsMap: Map<string, Immunization>;
  refReplacementMap: Map<string, string[]>;
} {
  const immunizationsMap = new Map<string, Immunization>();
  const refReplacementMap = new Map<string, string[]>();

  function assignMostDescriptiveStatus(
    master: Immunization,
    existing: Immunization,
    target: Immunization
  ): Immunization {
    master.status = pickMostDescriptiveStatus(statusRanking, existing.status, target.status);
    return master;
  }

  for (const immunization of immunizations) {
    const date = getDateFromResource(immunization, "date-hm");
    const { cvxCode, ndcCode } = extractCodes(immunization.vaccineCode);

    const key = cvxCode
      ? JSON.stringify({ date, cvxCode })
      : ndcCode
      ? JSON.stringify({ date, ndcCode })
      : undefined;
    if (key) {
      fillMaps(
        immunizationsMap,
        key,
        immunization,
        refReplacementMap,
        undefined,
        assignMostDescriptiveStatus
      );
    }
  }

  return {
    immunizationsMap,
    refReplacementMap,
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
      const system = coding.system?.toLowerCase();
      const code = coding.code?.trim().toLowerCase();
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
