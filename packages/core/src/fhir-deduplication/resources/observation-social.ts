import { Observation } from "@medplum/fhirtypes";
import {
  combineResources,
  fillMaps,
  getDateFromString,
  pickMostDescriptiveStatus,
} from "../shared";
import {
  extractCodes,
  extractValueFromObservation,
  retrieveCode,
  statusRanking,
  unknownCoding,
} from "./observation-shared";

export function deduplicateObservationsSocial(observations: Observation[]): {
  combinedObservations: Observation[];
  refReplacementMap: Map<string, string[]>;
} {
  const { observationsMap, refReplacementMap } = groupSameObservationsSocial(observations);
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
 * - code
 * - value
 *
 * For the date, let's create a range and expand it based on the measurements over time
 */
export function groupSameObservationsSocial(observations: Observation[]): {
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

    master = handleDates(master, existing, target);
    return master;
  }

  for (const observation of observations) {
    const keyCodes = extractCodes(observation.code);
    const keyCode = retrieveCode(keyCodes);
    const value = extractValueFromObservation(observation);

    if (value && keyCode) {
      const key = keyCode ? JSON.stringify({ value, keyCode }) : undefined;
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

// TODO: do we need to handle	effectiveTiming	and effectiveInstant?
function handleDates(master: Observation, obs1: Observation, obs2: Observation): Observation {
  // Extract dates from the first observation
  const date1Start = obs1.effectiveDateTime || obs1.effectivePeriod?.start;
  const date1End = obs1.effectivePeriod?.end || obs1.effectiveDateTime;

  // Extract dates from the second observation
  const date2Start = obs2.effectiveDateTime || obs2.effectivePeriod?.start;
  const date2End = obs2.effectivePeriod?.end || obs2.effectiveDateTime;

  // Gather all possible dates, filtering out undefined and invalid dates
  const dates = [date1Start, date1End, date2Start, date2End]
    .filter(Boolean)
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    .map(date => new Date(date!))
    .filter(date => !isNaN(date.getTime()));

  if (dates.length === 0) {
    return master;
  }

  const earliestDate = new Date(Math.min(...dates.map(date => date.getTime())));
  const latestDate = new Date(Math.max(...dates.map(date => date.getTime())));

  deleteMasterTimestamp(master);

  const startDateString = getDateFromString(earliestDate.toISOString(), "date-hm");
  const endDateString = getDateFromString(latestDate.toISOString(), "date-hm");

  const period = {
    start: startDateString,
    end: endDateString,
  };
  master.effectivePeriod = period;

  return master;
}

function deleteMasterTimestamp(obs: Observation): void {
  if ("effectiveDateTime" in obs) {
    delete obs.effectiveDateTime;
  } else if ("effectiveTiming" in obs) {
    delete obs.effectiveTiming;
  } else if ("effectiveInstant" in obs) {
    delete obs.effectiveInstant;
  }
}
