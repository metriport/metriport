import { CodeableConcept, Procedure } from "@medplum/fhirtypes";
import {
  CPT_CODE,
  CPT_OID,
  LOINC_CODE,
  LOINC_OID,
  SNOMED_CODE,
  SNOMED_OID,
} from "../../util/constants";
import {
  DeduplicationResult,
  combineResources,
  createRef,
  extractDisplayFromConcept,
  fillMaps,
  getPerformedDateFromResource,
  hasBlacklistedText,
  pickMostDescriptiveStatus,
  fetchCodingCodeOrDisplayOrSystem,
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

export const statusRanking: Record<ProcedureStatus, number> = {
  unknown: 0,
  "entered-in-error": 1,
  preparation: 2,
  "not-done": 3,
  "in-progress": 4,
  "on-hold": 5,
  stopped: 6,
  completed: 7,
};

export function deduplicateProcedures(procedures: Procedure[]): DeduplicationResult<Procedure> {
  const { proceduresMap, refReplacementMap, danglingReferences } = groupSameProcedures(procedures);
  return {
    combinedResources: combineResources({
      combinedMaps: [proceduresMap],
    }),
    refReplacementMap,
    danglingReferences,
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
  refReplacementMap: Map<string, string>;
  danglingReferences: Set<string>;
} {
  const proceduresMap = new Map<string, Procedure>();
  const refReplacementMap = new Map<string, string>();
  const danglingReferences = new Set<string>();

  function removeCodesAndAssignStatus(
    master: Procedure,
    existing: Procedure,
    target: Procedure
  ): Procedure {
    const code = master.code;
    const filtered = code?.coding?.filter(coding => {
      const system = fetchCodingCodeOrDisplayOrSystem(coding, "system");
      return (
        system?.includes(CPT_CODE) ||
        system?.includes(CPT_OID) ||
        system?.includes(LOINC_CODE) ||
        system?.includes(LOINC_OID) ||
        system?.includes(SNOMED_CODE) ||
        system?.includes(SNOMED_OID)
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

    master.status = pickMostDescriptiveStatus(statusRanking, existing.status, target.status);
    return master;
  }

  function postProcessOnlyStatus(
    master: Procedure,
    existing: Procedure,
    target: Procedure
  ): Procedure {
    master.status = pickMostDescriptiveStatus(statusRanking, existing.status, target.status);
    return master;
  }

  for (const procedure of procedures) {
    if (hasBlacklistedText(procedure.code)) {
      danglingReferences.add(createRef(procedure));
      continue;
    }

    const datetime = getPerformedDateFromResource(procedure, "datetime");
    if (!datetime) {
      danglingReferences.add(createRef(procedure));
      continue;
    }

    const { cptCode, loincCode, snomedCode } = extractCodes(procedure.code);

    let key;
    if (cptCode) key = JSON.stringify({ datetime, cptCode });
    else if (loincCode) key = JSON.stringify({ datetime, loincCode });
    else if (snomedCode) key = JSON.stringify({ datetime, snomedCode });

    if (key) {
      fillMaps(
        proceduresMap,
        key,
        procedure,
        refReplacementMap,
        undefined,
        removeCodesAndAssignStatus
      );
    } else {
      const display = extractDisplayFromConcept(procedure.code);
      if (display) {
        const key = JSON.stringify({ datetime, display });
        fillMaps(
          proceduresMap,
          key,
          procedure,
          refReplacementMap,
          undefined,
          postProcessOnlyStatus
        );
      } else {
        danglingReferences.add(createRef(procedure));
      }
    }
  }

  return {
    proceduresMap,
    refReplacementMap,
    danglingReferences,
  };
}

export function extractCodes(concept: CodeableConcept | undefined): {
  cptCode: string | undefined;
  loincCode: string | undefined;
  snomedCode: string | undefined;
} {
  let cptCode = undefined;
  let loincCode = undefined;
  let snomedCode = undefined;
  if (!concept) return { cptCode, loincCode, snomedCode };

  if (concept && concept.coding) {
    for (const coding of concept.coding) {
      const system = fetchCodingCodeOrDisplayOrSystem(coding, "system");
      const code = fetchCodingCodeOrDisplayOrSystem(coding, "code");
      if (system && code) {
        if (system.includes(CPT_CODE) || system.includes(CPT_OID)) {
          cptCode = code;
        } else if (system.includes(LOINC_CODE) || system.includes(LOINC_OID)) {
          loincCode = code;
        } else if (system.includes(SNOMED_CODE) || system.includes(SNOMED_OID)) {
          snomedCode = code;
        }
      }
    }
  }
  return { cptCode, loincCode, snomedCode };
}
