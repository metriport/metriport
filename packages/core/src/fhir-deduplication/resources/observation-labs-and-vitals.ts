import { Observation } from "@medplum/fhirtypes";
import {
  combineResources,
  fillMaps,
  getDateFromResource,
  pickMostDescriptiveStatus,
} from "../shared";
import {
  extractCodes,
  extractValueFromObservation,
  retrieveCode,
  statusRanking,
  unknownCoding,
} from "./observation-shared";

export function deduplicateObservationsLabsAndVitals(observations: Observation[]): {
  combinedObservations: Observation[];
  refReplacementMap: Map<string, string[]>;
} {
  const { observationsMap, refReplacementMap } = groupSameObservationsLabsAndVitals(observations);
  return {
    combinedObservations: combineResources({
      combinedMaps: [observationsMap],
    }),
    refReplacementMap,
  };
}

/**
 * Approach:
 * 1 map, where the key is made of:
 * - date
 * - code
 * - value
 */
export function groupSameObservationsLabsAndVitals(observations: Observation[]): {
  observationsMap: Map<string, Observation>;
  refReplacementMap: Map<string, string[]>;
} {
  const observationsMap = new Map<string, Observation>();
  const refReplacementMap = new Map<string, string[]>();

  function postProcess(
    master: Observation,
    existing: Observation,
    target: Observation
  ): Observation {
    const code = master.code;
    const filtered = code?.coding?.filter(coding => {
      const system = coding.system?.toLowerCase();
      const code = coding.code?.toLowerCase();
      return !system?.includes(unknownCoding.system) && !code?.includes(unknownCoding.code);
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

  for (const observation of observations) {
    const keyCodes = extractCodes(observation.code);
    const keyCode = retrieveCode(keyCodes);
    const date = getDateFromResource(observation);
    const value = extractValueFromObservation(observation);

    if (date && value && keyCode) {
      const key = keyCode ? JSON.stringify({ date, value, keyCode }) : undefined;
      if (key) {
        fillMaps(observationsMap, key, observation, refReplacementMap, undefined, postProcess);
      }
    }
  }

  return {
    observationsMap,
    refReplacementMap,
  };
}