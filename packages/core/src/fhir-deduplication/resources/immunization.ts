import { CodeableConcept, Immunization } from "@medplum/fhirtypes";
import { CVX_CODE, CVX_OID, NDC_CODE, NDC_OID } from "../../util/constants";
import {
  DeduplicationResult,
  combineResources,
  createKeysFromObjectArray,
  createKeysFromObjectArrayAndBits,
  createRef,
  deduplicateAndTrackResource,
  extractDisplayFromConcept,
  fetchCodingCodeOrDisplayOrSystem,
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

export function groupSameImmunizations(immunizations: Immunization[]): {
  immunizationsMap: Map<string, Immunization>;
  refReplacementMap: Map<string, string>;
  danglingReferences: Set<string>;
} {
  const resourceKeyMap = new Map<string, string>();
  const dedupedResourcesMap = new Map<string, Immunization>();

  const refReplacementMap = new Map<string, string>();
  const danglingReferences = new Set<string>();

  function assignMostDescriptiveStatus(existing: Immunization, target: Immunization) {
    const status = pickMostDescriptiveStatus(statusRanking, existing.status, target.status);
    existing.status = status;
    target.status = status;
  }

  const hasDate = 1;
  const hasNoDate = 0;

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

    const identifierKeys: string[] = [];
    const matchCandidateKeys: string[] = [];

    if (date) {
      // keys that match a code + date together
      identifierKeys.push(...createKeysFromObjectArray({ date }, identifiers));
      matchCandidateKeys.push(...createKeysFromObjectArray({ date }, identifiers));

      // flagging the vaccine to indicate having a date
      identifierKeys.push(...createKeysFromObjectArrayAndBits(identifiers, [hasDate]));

      // can dedup with a vaccine that has no date, as long as an identifier matches
      matchCandidateKeys.push(...createKeysFromObjectArrayAndBits(identifiers, [hasNoDate]));
    } else {
      // flagging the vaccine to indicate not having a date
      identifierKeys.push(...createKeysFromObjectArrayAndBits(identifiers, [hasNoDate]));

      // can dedup with a vaccine that does or does not have a date
      matchCandidateKeys.push(...createKeysFromObjectArrayAndBits(identifiers, [hasDate]));
      matchCandidateKeys.push(...createKeysFromObjectArrayAndBits(identifiers, [hasNoDate]));
    }

    if (identifierKeys.length > 0) {
      deduplicateAndTrackResource({
        resourceKeyMap,
        dedupedResourcesMap,
        matchCandidateKeys,
        identifierKeys,
        incomingResource: immunization,
        refReplacementMap,
        onPremerge: assignMostDescriptiveStatus,
      });
    } else {
      danglingReferences.add(createRef(immunization));
    }
  }

  return {
    immunizationsMap: dedupedResourcesMap,
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
