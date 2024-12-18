import { CodeableConcept, Observation } from "@medplum/fhirtypes";
import { cloneDeep } from "lodash";
import {
  DeduplicationResult,
  combineResources,
  createKeysFromObjectArray,
  createKeysFromObjectArrayAndBits,
  createRef,
  extractDisplayFromConcept,
  fetchCodingCodeOrDisplayOrSystem,
  fillL1L2Maps,
  getDateFromResource,
  hasBlacklistedText,
  isUnknownCoding,
  pickMostDescriptiveStatus,
  unknownCoding,
} from "../shared";
import { extractCodes, extractValueFromObservation, statusRanking } from "./observation-shared";

export function deduplicateObservations(
  observations: Observation[]
): DeduplicationResult<Observation> {
  const { observationsMap, refReplacementMap, danglingReferences } =
    groupSameObservations(observations);
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
 * - date
 * - code
 * - value
 */
export function groupSameObservations(observations: Observation[]): {
  observationsMap: Map<string, Observation>;
  refReplacementMap: Map<string, string>;
  danglingReferences: Set<string>;
} {
  const l1ObservationsMap = new Map<string, string>();
  const l2ObservationsMap = new Map<string, Observation>();

  const refReplacementMap = new Map<string, string>();
  const danglingReferences = new Set<string>();

  for (const observation of observations) {
    if (hasBlacklistedText(observation.code)) {
      danglingReferences.add(createRef(observation));
      continue;
    }

    const getterKeys: string[] = [];
    const setterKeys: string[] = [];

    const { observation: newObservation, code } = filterOutUnknownCodings(observation);

    const { loincCode, snomedCode, otherCode } = extractCodes(code);
    const display = extractDisplayFromConcept(code);

    const identifiers = [
      ...(loincCode ? [{ loincCode }] : []),
      ...(snomedCode ? [{ snomedCode }] : []),
      ...(otherCode ? [{ otherCode }] : []),
      ...(display ? [{ display }] : []),
    ];
    const date = getDateFromResource(newObservation);
    const value = extractValueFromObservation(observation);

    if (!value || !identifiers) {
      danglingReferences.add(createRef(observation));
      continue;
    }

    if (date) {
      // keys that match a code + date together
      setterKeys.push(...createKeysFromObjectArray({ date }, identifiers));
      getterKeys.push(...createKeysFromObjectArray({ date }, identifiers));
    }

    if (!date) {
      // flagging the observation to indicate not having a date
      setterKeys.push(...createKeysFromObjectArrayAndBits(identifiers, [0]));
      // can dedup with a observation that does or does not have a date
      getterKeys.push(...createKeysFromObjectArrayAndBits(identifiers, [0]));
    }

    if (setterKeys.length > 0) {
      fillL1L2Maps({
        map1: l1ObservationsMap,
        map2: l2ObservationsMap,
        getterKeys,
        setterKeys,
        targetResource: observation,
        refReplacementMap,
        applySpecialModifications: postProcess,
      });
    } else {
      danglingReferences.add(createRef(observation));
      continue;
    }
  }

  return {
    observationsMap: l2ObservationsMap,
    refReplacementMap,
    danglingReferences,
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

function postProcess(master: Observation, existing: Observation, target: Observation): Observation {
  const code = master.code;
  const filtered = code?.coding?.filter(coding => {
    const system = fetchCodingCodeOrDisplayOrSystem(coding, "system");
    const code = fetchCodingCodeOrDisplayOrSystem(coding, "code");
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
