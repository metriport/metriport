import { Observation } from "@medplum/fhirtypes";
import dayjs from "dayjs";
import utc from "dayjs/plugin/utc";
import {
  DeduplicationResult,
  combineResources,
  createRef,
  extractDisplayFromConcept,
  fillMaps,
  isUnknownCoding,
  pickMostDescriptiveStatus,
} from "../shared";
import {
  extractCodes,
  extractValueFromObservation,
  retrieveCode,
  statusRanking,
} from "./observation-shared";

dayjs.extend(utc);

export function deduplicateObservationsSocial(
  observations: Observation[]
): DeduplicationResult<Observation> {
  const { observationsMap, refReplacementMap, danglingReferences } =
    groupSameObservationsSocial(observations);
  return {
    combinedResources: combineResources({
      combinedMaps: [observationsMap],
    }),
    refReplacementMap,
    danglingReferences,
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
  refReplacementMap: Map<string, string>;
  danglingReferences: Set<string>;
} {
  const observationsMap = new Map<string, Observation>();
  const refReplacementMap = new Map<string, string>();
  const danglingReferences = new Set<string>();

  function postProcess(
    master: Observation,
    existing: Observation,
    target: Observation
  ): Observation {
    const code = master.code;
    const filtered = code?.coding?.filter(coding => !isUnknownCoding(coding));
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

  function postProcessOnlyStatus(
    master: Observation,
    existing: Observation,
    target: Observation
  ): Observation {
    master.status = pickMostDescriptiveStatus(statusRanking, existing.status, target.status);
    return master;
  }

  for (const observation of observations) {
    const keyCodes = extractCodes(observation.code);
    const keyCode = retrieveCode(keyCodes);
    const value = extractValueFromObservation(observation);

    if (!value) {
      danglingReferences.add(createRef(observation));
      continue;
    }

    if (keyCode) {
      const key = JSON.stringify({ value, keyCode });
      fillMaps(observationsMap, key, observation, refReplacementMap, undefined, postProcess);
    } else {
      const display = extractDisplayFromConcept(observation.code);
      if (display) {
        const key = JSON.stringify({ value, display });
        fillMaps(
          observationsMap,
          key,
          observation,
          refReplacementMap,
          undefined,
          postProcessOnlyStatus
        );
      } else {
        danglingReferences.add(createRef(observation));
      }
    }
  }

  return {
    observationsMap,
    refReplacementMap,
    danglingReferences,
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
    .map(date => dayjs(date))
    .filter(date => date.isValid());

  if (dates.length === 0) {
    return master;
  }

  const earliestDate = dates.reduce((min, curr) => (curr.isBefore(min) ? curr : min), dates[0]);
  const latestDate = dates.reduce((max, curr) => (curr.isAfter(max) ? curr : max), dates[0]);

  deleteMasterTimestamp(master);

  const startDateString = earliestDate?.toISOString();
  const endDateString = latestDate?.toISOString();

  const period = buildPeriod(startDateString, endDateString);
  if (period) master.effectivePeriod = period;

  return master;
}

function buildPeriod(
  date1: string | undefined,
  date2: string | undefined
):
  | {
      start?: string;
      end?: string;
    }
  | undefined {
  if (date1 && date2) {
    return {
      start: date1,
      end: date2,
    };
  } else if (date1) {
    return { start: date1 };
  } else if (date2) {
    return { start: date2 };
  }
  return undefined;
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
