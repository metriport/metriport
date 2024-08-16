import { Encounter } from "@medplum/fhirtypes";
import { combineResources, fillMaps, getDateFromResource } from "../shared";

export function deduplicateEncounters(medications: Encounter[]): {
  combinedEncounters: Encounter[];
  refReplacementMap: Map<string, string[]>;
} {
  const { encountersMap, remainingEncounters, refReplacementMap } =
    groupSameEncounters(medications);
  return {
    combinedEncounters: combineResources({
      combinedMaps: [encountersMap],
      remainingResources: remainingEncounters,
    }),
    refReplacementMap,
  };
}

/**
 * Approach:
 * 1 map, where the key is made of:
 * - status
 * - date
 * - class.code
 */
export function groupSameEncounters(encounters: Encounter[]): {
  encountersMap: Map<string, Encounter>;
  remainingEncounters: Encounter[];
  refReplacementMap: Map<string, string[]>;
} {
  const encountersMap = new Map<string, Encounter>();
  const refReplacementMap = new Map<string, string[]>();
  const remainingEncounters: Encounter[] = [];

  for (const encounter of encounters) {
    const classCode = encounter.class?.code;
    const date = getDateFromResource(encounter, "date");
    const status = encounter.status;
    console.log("DATE IS", date);
    if (date) {
      console.log("LOL??");
      const key = JSON.stringify({ date, status, classCode });
      fillMaps(encountersMap, key, encounter, refReplacementMap);
    } else {
      remainingEncounters.push(encounter);
    }
  }

  return {
    encountersMap,
    remainingEncounters,
    refReplacementMap,
  };
}
