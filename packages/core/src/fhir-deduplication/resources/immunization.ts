import { CodeableConcept, Immunization } from "@medplum/fhirtypes";
import { CVX_CODE, CVX_OID, NDC_CODE, NDC_OID } from "../../util/constants";
import {
  DeduplicationResult,
  combineResources,
  createRef,
  extractDisplayFromConcept,
  fillMaps,
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
  const {
    immunizationsNdcMap,
    immunizationsCvxMap,
    displayMap,
    refReplacementMap,
    danglingReferences,
  } = groupSameImmunizations(immunizations);
  return {
    combinedResources: combineResources({
      combinedMaps: [immunizationsNdcMap, immunizationsCvxMap, displayMap],
    }),
    refReplacementMap,
    danglingReferences,
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
  displayMap: Map<string, Immunization>;
  refReplacementMap: Map<string, string>;
  danglingReferences: string[];
} {
  const immunizationsCvxMap = new Map<string, Immunization>();
  const immunizationsNdcMap = new Map<string, Immunization>();
  const displayMap = new Map<string, Immunization>();
  const refReplacementMap = new Map<string, string>();
  const danglingReferencesSet = new Set<string>();

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
      danglingReferencesSet.add(createRef(immunization));
      continue;
    }

    const date = getDateFromResource(immunization, "datetime");
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
      } else {
        const displayCode = extractDisplayFromConcept(immunization.vaccineCode);
        if (displayCode) {
          const key = JSON.stringify({ date, displayCode });
          fillMaps(
            displayMap,
            key,
            immunization,
            refReplacementMap,
            undefined,
            assignMostDescriptiveStatus
          );
        } else {
          danglingReferencesSet.add(createRef(immunization));
        }
      }
    }
  }

  return {
    immunizationsCvxMap,
    immunizationsNdcMap,
    displayMap,
    refReplacementMap,
    danglingReferences: [...danglingReferencesSet],
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
