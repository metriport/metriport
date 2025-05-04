import { Encounter } from "@medplum/fhirtypes";
import {
  DeduplicationResult,
  combineResources,
  createKeysFromObjectArray,
  createRef,
  deduplicateAndTrackResource,
  getDateFromResource,
  pickMostDescriptiveStatus,
} from "../shared";

const encounterStatus = [
  "entered-in-error",
  "unknown",
  "planned",
  "arrived",
  "triaged",
  "in-progress",
  "onleave",
  "finished",
  "cancelled",
] as const;

export type EncounterStatus = (typeof encounterStatus)[number];

export const statusRanking: Record<EncounterStatus, number> = {
  unknown: 0,
  "entered-in-error": 1,
  planned: 2,
  cancelled: 3,
  arrived: 4,
  triaged: 5,
  "in-progress": 6,
  onleave: 7,
  finished: 8,
};

export function deduplicateEncounters(encounters: Encounter[]): DeduplicationResult<Encounter> {
  const { encountersMap, refReplacementMap, danglingReferences } = groupSameEncounters(encounters);
  return {
    combinedResources: combineResources({
      combinedMaps: [encountersMap],
    }),
    refReplacementMap,
    danglingReferences,
  };
}

/**
 * Approach:
 * 1 map, where the key is made of:
 * - date
 * - practitioner participant
 */
export function groupSameEncounters(encounters: Encounter[]): {
  encountersMap: Map<string, Encounter>;
  refReplacementMap: Map<string, string>;
  danglingReferences: Set<string>;
} {
  const resourceKeyMap = new Map<string, string>();
  const dedupedResourcesMap = new Map<string, Encounter>();

  const refReplacementMap = new Map<string, string>();
  const danglingReferences = new Set<string>();

  for (const encounter of encounters) {
    const datetime = getDateFromResource(encounter, "datetime");

    const practitionerRefsSet = new Set<string>();

    const identifierKeys: string[] = [];
    const matchCandidateKeys: string[] = [];

    encounter.participant?.forEach(participant => {
      const ref = participant.individual?.reference;
      if (ref) {
        if (ref.includes("Practitioner")) {
          practitionerRefsSet.add(ref);
          return;
        }
      }
    });

    const practitionerRefs = Array.from(practitionerRefsSet).map(p => ({ practitioner: p }));

    if (datetime) {
      if (practitionerRefs.length > 0) {
        const practitionerAndDateKeys = createKeysFromObjectArray({ datetime }, practitionerRefs);
        identifierKeys.push(...practitionerAndDateKeys);
        matchCandidateKeys.push(...practitionerAndDateKeys);
      } else if (practitionerRefs.length === 0) {
        const dateKey = JSON.stringify({ datetime });
        identifierKeys.push(dateKey);
        matchCandidateKeys.push(dateKey);
      }
    }

    if (identifierKeys.length > 0) {
      deduplicateAndTrackResource({
        resourceKeyMap,
        dedupedResourcesMap,
        identifierKeys,
        matchCandidateKeys,
        incomingResource: encounter,
        refReplacementMap,
        onPremerge: assignMostDescriptiveStatus,
      });
    } else {
      danglingReferences.add(createRef(encounter));
    }
  }

  return {
    encountersMap: dedupedResourcesMap,
    refReplacementMap,
    danglingReferences,
  };
}

function assignMostDescriptiveStatus(existing: Encounter, target: Encounter) {
  const status = pickMostDescriptiveStatus(statusRanking, existing.status, target.status);
  existing.status = status;
  target.status = status;
}
