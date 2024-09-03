import { Observation, CodeableConcept } from "@medplum/fhirtypes";
import { cloneDeep } from "lodash";
import {
  combineResources,
  createRef,
  extractDisplayFromConcept,
  fillMaps,
  getDateFromResource,
  hasBlacklistedText,
  pickMostDescriptiveStatus,
  unknownCoding,
  isUnknownCoding,
} from "../shared";
import {
  extractCodes,
  extractValueFromObservation,
  retrieveCode,
  statusRanking,
} from "./observation-shared";

export function deduplicateObservations(observations: Observation[]): {
  combinedObservations: Observation[];
  refReplacementMap: Map<string, string[]>;
  danglingReferences: string[];
} {
  const { observationsMap, refReplacementMap, danglingReferences } =
    groupSameObservations(observations);
  return {
    combinedObservations: combineResources({
      combinedMaps: [observationsMap],
    }),
    refReplacementMap,
    danglingReferences,
  };
}

/**
 * Approach:
 * 1 map, where the key is made of:
 * - date
 * - code
 * - value
 */
export function groupSameObservations(observations: Observation[]): {
  observationsMap: Map<string, Observation>;
  refReplacementMap: Map<string, string[]>;
  danglingReferences: string[];
} {
  const observationsMap = new Map<string, Observation>();
  const refReplacementMap = new Map<string, string[]>();
  const danglingReferencesSet = new Set<string>();

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
    if (hasBlacklistedText(observation.code)) {
      danglingReferencesSet.add(createRef(observation));
      continue;
    }

    // pre process
    const { observation: newObservation, code } = filterOutUnknownCodings(observation);

    const keyCodes = extractCodes(code);
    const keyCode = retrieveCode(keyCodes);
    const date = getDateFromResource(newObservation);
    const value = extractValueFromObservation(observation);

    if (!date || !value) {
      danglingReferencesSet.add(createRef(observation));
    } else {
      if (keyCode) {
        const key = JSON.stringify({ date, value, keyCode });
        fillMaps(observationsMap, key, observation, refReplacementMap, undefined, postProcess);
      } else {
        const observationDisplay = extractDisplayFromConcept(observation.code);
        if (observationDisplay) {
          const key = JSON.stringify({ date, value, observationDisplay });
          fillMaps(observationsMap, key, observation, refReplacementMap, undefined, postProcess);
        } else {
          danglingReferencesSet.add(createRef(observation));
        }
      }
    }
  }

  return {
    observationsMap,
    refReplacementMap,
    danglingReferences: [...danglingReferencesSet],
  };
}

function filterOutUnknownCodings(observation: Observation): {
  observation: Observation;
  code: CodeableConcept;
} {
  const newObservation = cloneDeep(observation);
  const code = { ...newObservation.code };

  if (code.coding) {
    code.coding = code.coding.filter(coding => !isUnknownCoding(coding));
  }

  newObservation.code = code;

  return { observation: newObservation, code };
}
