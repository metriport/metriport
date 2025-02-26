import { CodeableConcept, Observation } from "@medplum/fhirtypes";
import { cloneDeep } from "lodash";
import {
  DeduplicationResult,
  combineResources,
  createKeysFromObjectArray,
  createKeysFromObjectArrayAndBits,
  createRef,
  deduplicateAndTrackResource,
  extractDisplayFromConcept,
  fetchCodingCodeOrDisplayOrSystem,
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

export function groupSameObservations(observations: Observation[]): {
  observationsMap: Map<string, Observation>;
  refReplacementMap: Map<string, string>;
  danglingReferences: Set<string>;
} {
  const resourceKeyMap = new Map<string, string>();
  const dedupedResourcesMap = new Map<string, Observation>();

  const refReplacementMap = new Map<string, string>();
  const danglingReferences = new Set<string>();

  const hasDate = 1;
  const hasNoDate = 0;
  for (const observation of observations) {
    if (hasBlacklistedText(observation.code)) {
      danglingReferences.add(createRef(observation));
      continue;
    }

    const identifierKeys: string[] = [];
    const matchCandidateKeys: string[] = [];

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
      // keys that match a code + date + value together
      const completeKeysWithValue = createKeysFromObjectArray({ date }, identifiers).map(
        k => `${k}, ${JSON.stringify({ value })}`
      );

      identifierKeys.push(...completeKeysWithValue);
      matchCandidateKeys.push(...completeKeysWithValue);

      const keysWithDateBit = createKeysFromObjectArrayAndBits(identifiers, [hasDate]).map(
        k => `${k}, ${JSON.stringify({ value })}`
      );
      // flagging the observation to indicate having a date
      identifierKeys.push(...keysWithDateBit);
    }

    if (!date) {
      const identifierKeysWithDateBit = createKeysFromObjectArrayAndBits(identifiers, [
        hasNoDate,
      ]).map(k => `${k}, ${JSON.stringify({ value })}`);

      // flagging the observation to indicate not having a date
      identifierKeys.push(...identifierKeysWithDateBit);

      // with the getter keys with bit 0, it can dedup with other observations that don't have a date
      matchCandidateKeys.push(...identifierKeysWithDateBit);
      // with the getter keys with bit 1, it can dedup with other observations that have a date
      matchCandidateKeys.push(
        ...createKeysFromObjectArrayAndBits(identifiers, [hasDate]).map(
          k => `${k}, ${JSON.stringify({ value })}`
        )
      );
    }

    if (identifierKeys.length > 0) {
      deduplicateAndTrackResource({
        resourceKeyMap,
        dedupedResourcesMap,
        matchCandidateKeys,
        identifierKeys,
        incomingResource: observation,
        refReplacementMap,
        customMergeLogic: postProcess,
      });
    } else {
      danglingReferences.add(createRef(observation));
      continue;
    }
  }

  return {
    observationsMap: dedupedResourcesMap,
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
