import { Encounter } from "@medplum/fhirtypes";
import {
  DeduplicationResult,
  combineResources,
  createRef,
  fillMaps,
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
 * - class.code
 */
export function groupSameEncounters(encounters: Encounter[]): {
  encountersMap: Map<string, Encounter>;
  refReplacementMap: Map<string, string>;
  danglingReferences: string[];
} {
  const encountersMap = new Map<string, Encounter>();
  const refReplacementMap = new Map<string, string>();
  const danglingReferencesSet = new Set<string>();

  function assignMostDescriptiveStatus(
    master: Encounter,
    existing: Encounter,
    target: Encounter
  ): Encounter {
    master.status = pickMostDescriptiveStatus(statusRanking, existing.status, target.status);
    return master;
  }

  for (const encounter of encounters) {
    const datetime = getDateFromResource(encounter, "datetime");
    // TODO: Improve the key. Just date is not sufficient.
    if (datetime) {
      const key = JSON.stringify({ datetime });
      fillMaps(
        encountersMap,
        key,
        encounter,
        refReplacementMap,
        undefined,
        assignMostDescriptiveStatus
      );
    } else {
      danglingReferencesSet.add(createRef(encounter));
    }
  }

  return {
    encountersMap,
    refReplacementMap,
    danglingReferences: [...danglingReferencesSet],
  };
}
