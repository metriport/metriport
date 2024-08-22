import { CodeableConcept, Observation } from "@medplum/fhirtypes";
import { LOINC_CODE, LOINC_OID, SNOMED_CODE, SNOMED_OID } from "../../util/constants";
import {
  combineResources,
  fillMaps,
  getDateFromResource,
  pickMostDescriptiveStatus,
} from "../shared";
import { extractValueFromObservation, statusRanking } from "./observation-shared";

export function deduplicateObservationsLabs(observations: Observation[]): {
  combinedObservations: Observation[];
  refReplacementMap: Map<string, string[]>;
} {
  const { observationsMap, refReplacementMap } = groupSameObservationsLabs(observations);
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
export function groupSameObservationsLabs(observations: Observation[]): {
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
    return master;
  }

  for (const observation of observations) {
    const { loincCode, snomedCode } = extractCodes(observation.code);
    const date = getDateFromResource(observation);
    const value = extractValueFromObservation(observation);

    if (date && value && (loincCode || snomedCode)) {
      const key = loincCode
        ? JSON.stringify({ date, value, loincCode })
        : snomedCode
        ? JSON.stringify({ date, value, snomedCode })
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
