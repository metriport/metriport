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

export const statusRanking: Record<ImmunizationStatus, number> = {
  "entered-in-error": 0,
  "not-done": 1,
  completed: 2,
};

export function deduplicateImmunizations(immunizations: Immunization[]): {
  combinedImmunizations: Immunization[];
  refReplacementMap: Map<string, string[]>;
} {
  const { immunizationsNdcMap, immunizationsCvxMap, refReplacementMap } =
    groupSameImmunizations(immunizations);
  return {
    combinedImmunizations: combineResources({
      combinedMaps: [immunizationsNdcMap, immunizationsCvxMap],
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
  immunizationsCvxMap: Map<string, Immunization>;
  immunizationsNdcMap: Map<string, Immunization>;
  refReplacementMap: Map<string, string[]>;
} {
  const immunizationsCvxMap = new Map<string, Immunization>();
  const immunizationsNdcMap = new Map<string, Immunization>();
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
    if (date && date !== "unknown") {
      // TODO: should we keep date a mandatory field for dedup? If yes, then should we also add a default date to the FHIR encounter?
      const { cvxCode, ndcCode } = extractCodes(immunization.vaccineCode);

      if (cvxCode) {
        const key = JSON.stringify({ date, cvxCode });
        fillMaps(
          immunizationsCvxMap,
          key,
          immunization,
          refReplacementMap,
          undefined,
          assignMostDescriptiveStatus
        );
      } else if (ndcCode) {
        const key = JSON.stringify({ date, ndcCode });
        fillMaps(
          immunizationsNdcMap,
          key,
          immunization,
          refReplacementMap,
          undefined,
          assignMostDescriptiveStatus
        );
      }
    }
  }

  return {
    immunizationsCvxMap,
    immunizationsNdcMap,
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
