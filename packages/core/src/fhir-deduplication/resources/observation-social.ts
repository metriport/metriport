import { CodeableConcept, Observation } from "@medplum/fhirtypes";
import { LOINC_CODE, LOINC_OID, SNOMED_CODE, SNOMED_OID } from "../../util/constants";
import {
  combineResources,
  fillMaps,
  getDateFromString,
  pickMostDescriptiveStatus,
} from "../shared";

const observationStatus = [
  "entered-in-error",
  "unknown",
  "registered",
  "preliminary",
  "final",
  "amended",
  "corrected",
  "cancelled",
] as const;

export type ObservationStatus = (typeof observationStatus)[number];

export const statusRanking = {
  unknown: 0,
  "entered-in-error": 1,
  registered: 2,
  preliminary: 3,
  cancelled: 4,
  corrected: 5,
  amended: 6,
  final: 7,
};

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
      return (
        system?.includes(LOINC_CODE) ||
        system?.includes(LOINC_OID) ||
        system?.includes(SNOMED_CODE) ||
        system?.includes(SNOMED_OID)
      );
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
    const { loincCode, snomedCode } = extractCodes(observation.code);
    const value = extractValueFromObservation(observation);

    if (value && (loincCode || snomedCode)) {
      const key = loincCode
        ? JSON.stringify({ value, loincCode })
        : snomedCode
        ? JSON.stringify({ value, snomedCode })
        : undefined;
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
function handleDates(master: Observation, obs1: Observation, obs2: Observation) {
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

function deleteMasterTimestamp(obs: Observation) {
  if ("effectiveDateTime" in obs) {
    delete obs.effectiveDateTime;
  } else if ("effectiveTiming" in obs) {
    delete obs.effectiveTiming;
  } else if ("effectiveInstant" in obs) {
    delete obs.effectiveInstant;
  }
}

export function extractCodes(concept: CodeableConcept | undefined): {
  loincCode: string | undefined;
  snomedCode: string | undefined;
} {
  let loincCode = undefined;
  let snomedCode = undefined;
  if (!concept) return { loincCode, snomedCode };

  if (concept && concept.coding) {
    for (const coding of concept.coding) {
      const system = coding.system?.toLowerCase();
      const code = coding.code?.trim().toLowerCase();
      if (system && code) {
        if (system.includes(LOINC_CODE) || system.includes(LOINC_OID)) {
          loincCode = code;
        }
        if (system.includes(SNOMED_CODE) || system.includes(SNOMED_OID)) {
          snomedCode = code;
        }
      }
    }
  }
  return { loincCode, snomedCode };
}

function extractValueFromObservation(observation: Observation) {
  if (observation.valueQuantity) {
    return observation.valueQuantity;
  } else if (observation.valueCodeableConcept) {
    return observation.valueCodeableConcept;
  } else if (observation.valueString) {
    return observation.valueString;
  } else if (observation.valueBoolean) {
    return observation.valueBoolean;
  } else if (observation.valueInteger) {
    return observation.valueInteger;
  } else if (observation.valueRange) {
    return observation.valueRange;
  } else if (observation.valueRatio) {
    return observation.valueRatio;
  } else if (observation.valueSampledData) {
    return observation.valueSampledData;
  } else if (observation.valueTime) {
    return observation.valueTime;
  } else if (observation.valueDateTime) {
    return observation.valueDateTime;
  } else if (observation.valuePeriod) {
    return observation.valuePeriod;
  }
  return undefined;
}
