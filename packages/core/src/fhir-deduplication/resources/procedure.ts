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
  assignMostDescriptiveStatus,
  combineResources,
  createKeysFromObjectArray,
  createKeysFromObjectArrayAndBits,
  createRef,
  deduplicateAndTrackResource,
  extractDisplayFromConcept,
  fetchCodingCodeOrDisplayOrSystem,
  getPerformedDateFromResource,
  hasBlacklistedText,
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

function preprocessStatus(existing: Procedure, target: Procedure) {
  return assignMostDescriptiveStatus(statusRanking, existing, target);
}

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
  const resourceKeyMap = new Map<string, string>();
  const dedupedResourcesMap = new Map<string, Procedure>();

  const refReplacementMap = new Map<string, string>();
  const danglingReferences = new Set<string>();

  function postProcessCodes(master: Procedure): Procedure {
    const code = master.code;
    const codings = code?.coding;

    const isSingleCoding = codings && codings.length === 1;
    const display = extractDisplayFromConcept(code);

    const filtered = code?.coding?.filter(coding => {
      // If the condition only has one coding that provides insight with the `display` field, let's keep it
      const system = fetchCodingCodeOrDisplayOrSystem(coding, "system");
      return (
        system?.includes(CPT_CODE) ||
        system?.includes(CPT_OID) ||
        system?.includes(LOINC_CODE) ||
        system?.includes(LOINC_OID) ||
        system?.includes(SNOMED_CODE) ||
        system?.includes(SNOMED_OID) ||
        (isSingleCoding && display)
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

  const hasDate = 1;
  const hasNoDate = 0;

  for (const procedure of procedures) {
    if (hasBlacklistedText(procedure.code)) {
      danglingReferences.add(createRef(procedure));
      continue;
    }

    const datetime = getPerformedDateFromResource(procedure, "datetime");
    const { cptCode, loincCode, snomedCode } = extractCodes(procedure.code);
    const display = extractDisplayFromConcept(procedure.code);

    const identifiers = [
      ...(cptCode ? [{ cptCode }] : []),
      ...(loincCode ? [{ loincCode }] : []),
      ...(snomedCode ? [{ snomedCode }] : []),
      ...(display ? [{ display }] : []),
    ];
    const hasIdentifier = identifiers.length > 0;

    if (!hasIdentifier) {
      danglingReferences.add(createRef(procedure));
      continue;
    }
    const identifierKeys: string[] = [];
    const matchCandidateKeys: string[] = [];

    if (datetime) {
      // keys that match a code + date together
      identifierKeys.push(...createKeysFromObjectArray({ datetime }, identifiers));
      matchCandidateKeys.push(...createKeysFromObjectArray({ datetime }, identifiers));

      // flagging the procedure to indicate having a date
      identifierKeys.push(...createKeysFromObjectArrayAndBits(identifiers, [hasDate]));

      // can dedup with a procedure that has no date, as long as an identifier matches
      matchCandidateKeys.push(...createKeysFromObjectArrayAndBits(identifiers, [hasNoDate]));
    } else {
      // flagging the procedure to indicate not having a date
      identifierKeys.push(...createKeysFromObjectArrayAndBits(identifiers, [hasNoDate]));

      // can dedup with a procedure that does or does not have a date
      matchCandidateKeys.push(...createKeysFromObjectArrayAndBits(identifiers, [hasDate]));
      matchCandidateKeys.push(...createKeysFromObjectArrayAndBits(identifiers, [hasNoDate]));
    }

    if (identifierKeys.length > 0) {
      deduplicateAndTrackResource({
        resourceKeyMap,
        dedupedResourcesMap,
        identifierKeys,
        matchCandidateKeys,
        incomingResource: procedure,
        refReplacementMap,
        onPremerge: preprocessStatus,
        onPostmerge: postProcessCodes,
      });
    } else {
      danglingReferences.add(createRef(procedure));
    }
  }

  return {
    proceduresMap: dedupedResourcesMap,
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
