import { Encounter } from "@medplum/fhirtypes";
import {
  combineResources,
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

export const statusRanking = {
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

export function deduplicateEncounters(encounters: Encounter[]): {
  combinedEncounters: Encounter[];
  refReplacementMap: Map<string, string[]>;
} {
  const { encountersMap, refReplacementMap } = groupSameEncounters(encounters);
  return {
    combinedEncounters: combineResources({
      combinedMaps: [encountersMap],
    }),
    refReplacementMap,
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
  refReplacementMap: Map<string, string[]>;
} {
  const encountersMap = new Map<string, Encounter>();
  const refReplacementMap = new Map<string, string[]>();

  function assignMostDescriptiveStatus(
    master: Encounter,
    existing: Encounter,
    target: Encounter
  ): Encounter {
    master.status = pickMostDescriptiveStatus(statusRanking, existing.status, target.status);
    return master;
  }

  for (const encounter of encounters) {
    const classCode = encounter.class?.code;
    const date = getDateFromResource(encounter, "date-hm");
    if (date && classCode) {
      const key = JSON.stringify({ date, classCode });
      fillMaps(
        encountersMap,
        key,
        encounter,
        refReplacementMap,
        undefined,
        assignMostDescriptiveStatus
      );
    }
  }

  return {
    encountersMap,
    refReplacementMap,
  };
}
