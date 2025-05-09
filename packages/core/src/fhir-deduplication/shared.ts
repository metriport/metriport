import { CodeableConcept, Coding, Identifier, Period, Resource } from "@medplum/fhirtypes";
import { errorToString } from "@metriport/shared";
import dayjs from "dayjs";
import utc from "dayjs/plugin/utc";
import _, { cloneDeep } from "lodash";
import { capture, out } from "../util";
import { uuidv7 } from "../util/uuid-v7";

dayjs.extend(utc);

const NO_KNOWN_SUBSTRING = "no known";
const MISSING_ATTR = "-";

const dateFormats = ["datetime", "date"] as const;
const unknownValues = ["unknown", "unk", "no known"];

export const UNK_CODE = "UNK";
export const UNKNOWN_DISPLAY = "unknown";
export type DateFormats = (typeof dateFormats)[number];

export type OnPremergeCallback<T> = (base: T, additional: T) => void;
export type OnPostmergeCallback<T> = (base: T) => T;

export type CompositeKey = {
  code: string;
  date: string | undefined;
};

export function getDateFromString(dateString: string, dateFormat?: "date" | "datetime"): string {
  const date = dayjs(dateString);

  if (!date.isValid()) {
    throw new Error("Invalid date string");
  }

  if (dateFormat === "datetime") {
    return date.toISOString();
  } else {
    return date.format("YYYY-MM-DD");
  }
}

export const artifactRelatedArtifactUrl =
  "http://hl7.org/fhir/StructureDefinition/artifact-relatedArtifact";

function createExtensionRelatedArtifact(resourceType: string, id: string | undefined) {
  return {
    url: artifactRelatedArtifactUrl,
    valueRelatedArtifact: { type: "derived-from", display: `${resourceType}/${id}` },
  };
}

//eslint-disable-next-line @typescript-eslint/no-explicit-any
export function mergeIntoTargetResource<T extends Resource & { extension?: any[] }>(
  target: T,
  source: T,
  isExtensionIncluded = true
) {
  const extensionRef = createExtensionRelatedArtifact(source.resourceType, source.id);
  const originalExtension = "extension" in target ? [...target.extension] : [];
  mutativeDeepMerge(target, source, isExtensionIncluded);

  // This part combines resources together and adds the ID references of the duplicates into the master resource
  // regardless of whether new information was found

  if (!isExtensionIncluded) {
    delete target.extension;
  } else if ("extension" in target) {
    target.extension = [...originalExtension, extensionRef];
  } else {
    target.extension = [extensionRef];
  }
}

// TODO: Might be a good idea to include a check to see if all resources refer to the same patient
const conditionKeysToIgnore = ["id", "resourceType", "subject"];

/**
 * Mutatively merge the contents of source into target
 * @param target the object that will be modified
 * @param source the object that is the source of data entering target
 * @param isExtensionIncluded whether to include the extension field when merging resources
 */
//eslint-disable-next-line @typescript-eslint/no-explicit-any
export function mutativeDeepMerge(target: any, source: any, isExtensionIncluded: boolean) {
  for (const key of Object.keys(source)) {
    if (key === "extension" && !isExtensionIncluded) continue;
    if (conditionKeysToIgnore.includes(key)) continue;

    if (Array.isArray(source[key]) && Array.isArray(target[key])) {
      // Combine arrays and remove duplicates based on unique properties
      mutativeMergeArrays(target[key], source[key]);
    } else if (source[key] instanceof Object && key in target) {
      // Recursively merge objects
      mutativeDeepMerge(target[key], source[key], isExtensionIncluded);
    } else {
      if (key === "__proto__" || key === "constructor") continue;
      if (
        typeof source[key] === "string" &&
        unknownValues.some(unk => source[key].toLowerCase().includes(unk))
      )
        continue;
      target[key] = source[key];
    }
  }
}

/**
 * Merge the two objects, returning a new object
 */
//eslint-disable-next-line @typescript-eslint/no-explicit-any
export function deepMerge(target: any, source: any, isExtensionIncluded: boolean): any {
  const combined = cloneDeep(target);
  mutativeDeepMerge(combined, source, isExtensionIncluded);
  return combined;
}

/**
 * Mutatively merge the contents of sourceArray into targetArray
 * @param targetArray the array to that will be modified
 * @param sourceArray the array that is the source of data entering targetArray
 */
//eslint-disable-next-line @typescript-eslint/no-explicit-any
export function mutativeMergeArrays(targetArray: any[], sourceArray: any[]) {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const preprocessedTargetArray = targetArray.map(v => JSON.stringify(v));
  for (const sourceItem of sourceArray) {
    const preprocessedSourceItem = JSON.stringify(sourceItem);
    const duplicate = preprocessedTargetArray.find(
      targetItem => targetItem === preprocessedSourceItem
    );

    if (!duplicate) {
      targetArray.push(sourceItem);
    }
  }
}

export function combineResources<T>({ combinedMaps }: { combinedMaps: Map<string, T>[] }): T[] {
  const combinedResources: T[] = [];
  for (const map of combinedMaps) {
    for (const condition of map.values()) {
      combinedResources.push(condition);
    }
  }
  return combinedResources;
}

/**
 * Deduplicates a resource within the resource map. If the key doesn't match an existing resource, the target resource will be added to the map.
 */
export function deduplicateWithinMap<T extends Resource>({
  dedupedResourcesMap,
  dedupKey,
  candidateResource,
  refReplacementMap,
  isExtensionIncluded = true,
  onPremerge,
  onPostmerge,
}: {
  dedupedResourcesMap: Map<string, T>;
  dedupKey: string;
  candidateResource: T;
  refReplacementMap: Map<string, string>;
  isExtensionIncluded?: boolean;
  onPremerge?: OnPremergeCallback<T> | undefined;
  onPostmerge?: OnPostmergeCallback<T> | undefined;
}): void {
  const existingResource = dedupedResourcesMap.get(dedupKey);
  // if its a duplicate, combine the resources
  if (existingResource?.id) {
    const masterRef = `${existingResource.resourceType}/${existingResource.id}`;
    let target = existingResource;
    if (onPremerge) {
      onPremerge(target, candidateResource);
    }
    mergeIntoTargetResource(target, candidateResource, isExtensionIncluded);
    if (onPostmerge) {
      target = onPostmerge(target);
    }
    dedupedResourcesMap.set(dedupKey, target);

    if (candidateResource.id) {
      const consumedRef = `${candidateResource.resourceType}/${candidateResource.id}`;
      refReplacementMap.set(consumedRef, masterRef);
    }
  } else {
    dedupedResourcesMap.set(dedupKey, candidateResource);
  }
}

export function createKeysFromObjectArrayAndFlagBits(
  baseObject: object,
  contactsOrAddresses: object[],
  flagBits: number[]
): string[] {
  return contactsOrAddresses.map(item => JSON.stringify({ baseObject, ...item, flagBits }));
}

export function createKeysFromObjectArray(baseObject: object, keyObjects: object[]): string[] {
  return keyObjects.map(item => JSON.stringify({ baseObject, ...item }));
}

export function createKeysFromObjectArrayAndBits(keyObjects: object[], bits: number[]): string[] {
  return keyObjects.map(item => JSON.stringify({ item, bits }));
}

export function createKeysFromObjectAndFlagBits(object: object, bits: number[]): string[] {
  return [JSON.stringify({ ...object, bits })];
}

export function createKeyFromObjects(...objects: object[]): string {
  const combinedObject = objects.reduce((acc, obj) => ({ ...acc, ...obj }), {});
  return JSON.stringify(combinedObject);
}

export function fillL1L2Maps<T extends Resource>({
  map1,
  map2,
  getterKeys,
  setterKeys,
  targetResource,
  refReplacementMap,
  isExtensionIncluded = true,
  onPremerge,
  onPostmerge,
}: {
  map1: Map<string, string>;
  map2: Map<string, T>;
  getterKeys: string[];
  setterKeys: string[];
  targetResource: T;
  refReplacementMap: Map<string, string>;
  isExtensionIncluded?: boolean;
  onPremerge?: OnPremergeCallback<T>;
  onPostmerge?: OnPostmergeCallback<T>;
}): void {
  let map2Key = undefined;
  for (const key of getterKeys) {
    map2Key = map1.get(key); // Potential improvement. We just select the first uuid that matches. What if multple matches exist?
    if (map2Key) {
      deduplicateWithinMap({
        dedupedResourcesMap: map2,
        dedupKey: map2Key,
        candidateResource: targetResource,
        refReplacementMap,
        isExtensionIncluded,
        onPremerge,
        onPostmerge,
      });
      break;
    }
  }
  if (!map2Key) {
    map2Key = uuidv7();
    for (const key of setterKeys) {
      map1.set(key, map2Key);
    }
    // fill L2 map only once to avoid duplicate entries
    deduplicateWithinMap({
      dedupedResourcesMap: map2,
      dedupKey: map2Key,
      candidateResource: targetResource,
      refReplacementMap,
      isExtensionIncluded,
      onPremerge,
      onPostmerge,
    });
  }
}

export function getDateFromResource<T extends Resource>(
  resource: T,
  dateFormat?: DateFormats
): string | undefined {
  if ("onsetPeriod" in resource) {
    const onsetPeriod = resource.onsetPeriod;
    if (onsetPeriod.start) {
      return getDateFromString(onsetPeriod.start, dateFormat);
    } else if (onsetPeriod.end) {
      return getDateFromString(onsetPeriod.end, dateFormat);
    }
  } else if ("onsetDateTime" in resource) {
    return getDateFromString(resource.onsetDateTime, dateFormat);
  } else if ("onsetAge" in resource) {
    const onsetAge = resource.onsetAge;
    if (onsetAge.value) {
      return onsetAge.value.toString() + resource.onsetAge.unit;
    }
  } else if ("effectiveDateTime" in resource) {
    return getDateFromString(resource.effectiveDateTime, dateFormat);
  } else if ("date" in resource) {
    return getDateFromString(resource.date, dateFormat);
  } else if ("occurrenceDateTime" in resource) {
    const dateTime = resource.occurrenceDateTime;
    return getDateFromString(dateTime, dateFormat);
  } else if ("occurrenceString" in resource) {
    return resource.occurrenceString;
  } else if ("period" in resource) {
    const period = resource.period;
    if (period.start) return getDateFromString(period.start, dateFormat);
    else if (period.end) return getDateFromString(period.end, dateFormat);
  } else if ("effectivePeriod" in resource) {
    if (resource.effectivePeriod.start) {
      return getDateFromString(resource.effectivePeriod.start, dateFormat);
    } else if (resource.effectivePeriod.end) {
      return getDateFromString(resource.effectivePeriod.end, dateFormat);
    }
  }
  return undefined;
}

export function getPerformedDateFromResource<T extends Resource>(
  resource: T,
  dateFormat?: DateFormats
): string | undefined {
  if ("performedDateTime" in resource) {
    return getDateFromString(resource.performedDateTime, dateFormat);
  } else if ("performedPeriod" in resource) {
    if (resource.performedPeriod.start) {
      return getDateFromString(resource.performedPeriod.start, dateFormat);
    } else if (resource.performedPeriod.end) {
      return getDateFromString(resource.performedPeriod.end, dateFormat);
    }
  } else if ("performedString" in resource) {
    return getDateFromString(resource.performedString, dateFormat);
  } else if ("performedAge" in resource) {
    const onsetAge = resource.performedAge;
    if (onsetAge.value) {
      return onsetAge.value.toString() + resource.performedAge.unit;
    }
  } else if ("performedRange" in resource) {
    const range = resource.performedRange;
    if (range.low?.value) {
      return range.low.value.toString() + range.low.unit;
    } else if (range.high?.value) {
      return range.high.value.toString() + range.high.unit;
    }
  }

  return undefined;
}

/**
 * Of the two statuses, picks the more desciptive one based on the ranking provided.
 */
export function pickMostDescriptiveStatus<T extends string>(
  statusRanking: Record<T, number>,
  status1: T | undefined,
  status2: T | undefined
): T {
  if (status1 && status2) {
    return statusRanking[status1] > statusRanking[status2] ? status1 : status2;
  }

  const status = status1 ?? status2;
  if (!status) {
    const lowestRanking = (Object.keys(statusRanking) as T[]).find(key => statusRanking[key] === 0);
    if (!lowestRanking) {
      throw new Error("unreachable");
    }
    return lowestRanking;
  }
  return status;
}

export function hasBlacklistedText(concept: CodeableConcept | undefined): boolean {
  const knownCodings = concept?.coding?.filter(c => !isUnknownCoding(c));
  return (
    concept?.text?.toLowerCase().includes(NO_KNOWN_SUBSTRING) ?? !knownCodings?.length ?? false
  );
}

export function createRef<T extends Resource>(res: T): string {
  if (!res.id) throw new Error("FHIR Resource has no ID");
  return `${res.resourceType}/${res.id}`;
}

export function extractDisplayFromConcept(
  concept: CodeableConcept | undefined
): string | undefined {
  const displayCoding = concept?.coding?.find(coding => {
    const code = fetchCodingCodeOrDisplayOrSystem(coding, "code");
    const display = fetchCodingCodeOrDisplayOrSystem(coding, "display");
    if (code !== UNK_CODE && display !== UNKNOWN_DISPLAY) {
      return display;
    }
    return;
  });
  if (displayCoding?.display) return displayCoding?.display;
  const text = concept?.text;
  if (!text?.includes(UNKNOWN_DISPLAY)) return text;
  return undefined;
}

export function extractNpi(identifiers: Identifier[] | undefined): string | undefined {
  if (!identifiers) return undefined;

  const npiIdentifier = identifiers.find(i => i.system?.includes("us-npi") && i.value);
  return npiIdentifier?.value;
}

export const unknownCoding = {
  system: "http://terminology.hl7.org/ValueSet/v3-Unknown",
  code: "UNK",
  display: "unknown",
};

export const unknownCode = {
  coding: [unknownCoding],
  text: "unknown",
};

export function isUnknownCoding(coding: Coding, text?: string | undefined): boolean {
  if (_.isEqual(coding, unknownCoding)) return true;
  const code = fetchCodingCodeOrDisplayOrSystem(coding, "code");
  const display = fetchCodingCodeOrDisplayOrSystem(coding, "display");

  if (code) {
    return (
      code?.includes(unknownCoding.code.toLowerCase()) &&
      (!display || display === unknownCoding.display.toLowerCase()) &&
      (!text || text === unknownCode.text.toLowerCase())
    );
  } else {
    return (
      (!display ||
        display === unknownCoding.display.toLowerCase() ||
        display.includes("no data available")) &&
      (!text || text === unknownCode.text.toLowerCase() || text.includes("no data"))
    );
  }
}

export function isUselessDisplay(text: string) {
  const normalizedText = text.toLowerCase().trim();
  return unknownValues.includes(normalizedText) || normalizedText.includes("no data available");
}

export type DeduplicationResult<T extends Resource> = {
  combinedResources: T[];
  refReplacementMap: Map<string, string>;
  danglingReferences: Set<string>;
};

export function ensureValidPeriod(period: Period | undefined): Period | undefined {
  if (!period) return undefined;

  const startDate = period.start ? dayjs.utc(period.start) : null;
  const endDate = period.end ? dayjs.utc(period.end) : null;

  if (startDate && endDate) {
    if (startDate.isAfter(endDate)) {
      const result = { start: endDate.toISOString(), end: startDate.toISOString() };
      return result;
    }
  }
  return period;
}

export function fetchCodingCodeOrDisplayOrSystem(
  coding: Coding,
  field: "code" | "display" | "system"
): string | undefined {
  const { log } = out(`fetchCodingCodeOrDisplayOrSystem - coding ${JSON.stringify(coding)}`);
  try {
    return coding[field]?.toString().trim().toLowerCase();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } catch (error: any) {
    if (error instanceof TypeError) {
      const msg = "Error fetching field from coding";
      log(`${msg}. Cause: ${errorToString(error)}`);
      capture.message(msg, {
        extra: {
          coding,
          error,
        },
        level: "info",
      });
      return undefined;
    }
    throw error;
  }
}

export function fetchCodeableConceptText(concept: CodeableConcept): string | undefined {
  const { log } = out(`fetchCodeableConceptText - coding ${JSON.stringify(concept)}`);
  try {
    return concept.text?.trim().toLowerCase();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } catch (error: any) {
    if (error instanceof TypeError) {
      const msg = "Error fetching field from concept";
      log(`${msg}. Cause: ${errorToString(error)}`);
      capture.message(msg, {
        extra: {
          concept,
          error,
        },
        level: "info",
      });
      return undefined;
    }
    throw error;
  }
}

export function assignMostDescriptiveStatus<T extends Resource & { status?: string }>(
  statusRanking: Record<string, number>,
  existing: T,
  target: T
) {
  const status = pickMostDescriptiveStatus(statusRanking, existing.status, target.status);
  existing.status = status;
  target.status = status;
}

/**
 * Manages the deduplication of FHIR resources by maintaining a two-level mapping system:
 * - Level 1 (referenceMap): Maps identifying characteristics to a resource reference ID
 * - Level 2 (resourceMap): Maps resource reference IDs to the actual merged (deduplicated) resources
 *
 * When a duplicate is found, it merges the resources and maintains references to track
 * which resources were combined.
 *
 * resourceKeyMap contains references to a resource based on all deduplication keys that were created for it. i.e.:
 * `{{"snomedCode":"123",required"}, {"date":"2024-10-01",required}}` => `resource reference ID`
 * `{{"loincCode":"abcd",required"}, {"date":"2024-10-01",optional}}` => `resource reference ID`
 * `{{"loincCode":"abcd",required"}, {"date":"-",optional}}` => `resource reference ID`
 *
 * dedupedResourcesMap contains resource reference IDs pointing to deduplicated resources. i.e.:
 * `resource reference ID #1` => deduplicated master resource #1
 * `resource reference ID #2` => deduplicated master resource #2
 *
 * @param params Configuration object with the following properties:
 * @param params.resourceKeyMap - Maps resource characteristics to unique resource IDs
 * @param params.dedupedResourcesMap - Maps unique IDs to merged resources
 * @param params.identifierKeys - Array of strings that identify this resource
 * @param params.matchCandidateKeys - Potential matching resource identifiers to check against
 * @param params.incomingResource - The new resource to deduplicate
 * @param params.referenceUpdates - Tracks updates needed for references to merged resources
 * @param params.keepExtensions - Whether to preserve FHIR extensions during merging
 * @param params.customMergeLogic - Optional callback for resource-specific merge logic
 */
export function deduplicateAndTrackResource<T extends Resource>({
  resourceKeyMap,
  dedupedResourcesMap,
  identifierKeys,
  matchCandidateKeys,
  incomingResource,
  refReplacementMap,
  keepExtensions = true,
  onPremerge,
  onPostmerge,
}: {
  resourceKeyMap: Map<string, string>;
  dedupedResourcesMap: Map<string, T>;
  identifierKeys: string[];
  matchCandidateKeys: string[];
  incomingResource: T;
  refReplacementMap: Map<string, string>;
  keepExtensions?: boolean;
  onPremerge?: OnPremergeCallback<T>;
  onPostmerge?: OnPostmergeCallback<T>;
}): void {
  let masterResourceId = undefined;

  // Check if this resource matches any existing ones
  for (const candidateKey of matchCandidateKeys) {
    masterResourceId = resourceKeyMap.get(candidateKey);
    if (masterResourceId) {
      deduplicateWithinMap({
        dedupedResourcesMap,
        dedupKey: masterResourceId,
        candidateResource: incomingResource,
        refReplacementMap,
        isExtensionIncluded: keepExtensions,
        onPremerge,
        onPostmerge,
      });
      break;
    }
  }

  // If no match found, create new entry
  if (!masterResourceId) {
    masterResourceId = uuidv7();
    for (const identifier of identifierKeys) {
      resourceKeyMap.set(identifier, masterResourceId);
    }
    deduplicateWithinMap({
      dedupedResourcesMap,
      dedupKey: masterResourceId,
      candidateResource: incomingResource,
      refReplacementMap,
      isExtensionIncluded: keepExtensions,
      onPremerge,
      onPostmerge,
    });
  }
}

export function buildKeyFromValueAndMissingRequiredAttribute(
  value: object,
  attribute: string
): string {
  return `${required({ ...value })},${required({ [attribute]: MISSING_ATTR })}`;
}

export function buildKeyFromValueAndRequiredAttribute(value: object, attribute: string): string {
  return `${required({ ...value })},${required({ attribute })}`;
}

export function buildKeyFromValueAndMissingOptionalAttribute(
  value: object,
  attribute: string
): string {
  return `${required({ ...value })},${optional({ [attribute]: MISSING_ATTR })}`;
}

export function buildKeyFromValueAndOptionalAttribute(value: object, attribute: string): string {
  return `${required({ ...value })},${optional({ attribute })}`;
}

export function buildKeyFromValueAndMissingDynamicAttribute(
  value: object,
  attribute: string,
  isRequired: boolean
): string {
  if (isRequired) {
    return buildKeyFromValueAndMissingRequiredAttribute(value, attribute);
  }
  return buildKeyFromValueAndMissingOptionalAttribute(value, attribute);
}

export function required(value: object): string {
  return `${JSON.stringify({ ...value })},required`;
}

export function optional(value: object): string {
  return `${JSON.stringify({ ...value })},optional`;
}
