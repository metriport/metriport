import { CodeableConcept, Procedure } from "@medplum/fhirtypes";
import { CPT_CODE, CPT_OID, LOINC_CODE, LOINC_OID } from "../../util/constants";
import {
  combineResources,
  fillMaps,
  getPerformedDateFromResource,
  pickMostDescriptiveStatus,
} from "../shared";

const procedureStatus = [
  "entered-in-error",
  "completed",
  "not-done",
  "preparation",
  "in-progress",
  "on-hold",
  "stopped",
  "unknown",
] as const;

export type ProcedureStatus = (typeof procedureStatus)[number];

export const statusRanking = {
  unknown: 0,
  "entered-in-error": 1,
  preparation: 2,
  "not-done": 3,
  "in-progress": 4,
  "on-hold": 5,
  stopped: 6,
  completed: 7,
};

export function deduplicateProcedures(procedures: Procedure[]): {
  combinedProcedures: Procedure[];
  refReplacementMap: Map<string, string[]>;
} {
  const { proceduresMap, refReplacementMap } = groupSameProcedures(procedures);
  return {
    combinedProcedures: combineResources({
      combinedMaps: [proceduresMap],
    }),
    refReplacementMap,
  };
}

/**
 * Approach:
 * 1 map, where the key is made of:
 * - code - using CPT or LOINC, while removing codes from other code systems
 * - date (occurenceDateTime or occurenceString)
 */
export function groupSameProcedures(procedures: Procedure[]): {
  proceduresMap: Map<string, Procedure>;
  refReplacementMap: Map<string, string[]>;
} {
  const proceduresMap = new Map<string, Procedure>();
  const refReplacementMap = new Map<string, string[]>();

  function removeCodesAndAssignStatus(
    master: Procedure,
    existing: Procedure,
    target: Procedure
  ): Procedure {
    const code = master.code;
    const filtered = code?.coding?.filter(coding => {
      const system = coding.system?.toLowerCase();
      return (
        system?.includes(CPT_CODE) ||
        system?.includes(CPT_OID) ||
        system?.includes(LOINC_CODE) ||
        system?.includes(LOINC_OID)
      );
    });
    if (filtered) {
      master.code = {
        ...code,
        coding: filtered,
      };
    }

    master.status = pickMostDescriptiveStatus(statusRanking, existing.status, target.status);
    return master;
  }

  for (const procedure of procedures) {
    const date = getPerformedDateFromResource(procedure, "date-hm");
    if (!date) continue;

    const { cptCode, loincCode } = extractCodes(procedure.code);

    const key = cptCode
      ? JSON.stringify({ date, cptCode })
      : loincCode
      ? JSON.stringify({ date, loincCode })
      : undefined;
    if (key) {
      fillMaps(
        proceduresMap,
        key,
        procedure,
        refReplacementMap,
        undefined,
        removeCodesAndAssignStatus
      );
    }
  }

  return {
    proceduresMap,
    refReplacementMap,
  };
}

export function extractCodes(concept: CodeableConcept | undefined): {
  cptCode: string | undefined;
  loincCode: string | undefined;
} {
  let cptCode = undefined;
  let loincCode = undefined;
  if (!concept) return { cptCode, loincCode };

  if (concept && concept.coding) {
    for (const coding of concept.coding) {
      const system = coding.system?.toLowerCase();
      const code = coding.code?.trim().toLowerCase();
      if (system && code) {
        if (system.includes(CPT_CODE) || system.includes(CPT_OID)) {
          cptCode = code;
        } else if (system.includes(LOINC_CODE) || system.includes(LOINC_OID)) {
          loincCode = code;
        }
      }
    }
  }
  return { cptCode, loincCode };
}
