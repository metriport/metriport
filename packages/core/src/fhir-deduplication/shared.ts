import {
  CodeableConcept,
  Coding,
  Identifier,
  Resource,
  ContactPoint,
  Address,
} from "@medplum/fhirtypes";
import dayjs from "dayjs";
import _, { cloneDeep } from "lodash";
import { v4 as uuidv4 } from "uuid";

const NO_KNOWN_SUBSTRING = "no known";

const dateFormats = ["datetime", "date"] as const;

export const UNK_CODE = "UNK";
export const UNKNOWN_DISPLAY = "unknown";
export type DateFormats = (typeof dateFormats)[number];

export type ApplySpecialModificationsCallback<T> = (merged: T, existing: T, target: T) => T;

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

function createExtensionRelatedArtifact(resourceType: string, id: string | undefined) {
  return {
    url: "http://hl7.org/fhir/StructureDefinition/artifact-relatedArtifact",
    valueRelatedArtifact: { type: "derived-from", display: `${resourceType}/${id}` },
  };
}

export function combineTwoResources<T extends Resource>(
  r1: T,
  r2: T,
  isExtensionIncluded = true
): T {
  const combined = deepMerge({ ...r1 }, r2, isExtensionIncluded);
  const extensionRef = createExtensionRelatedArtifact(r2.resourceType, r2.id);

  // This part combines resources together and adds the ID references of the duplicates into the master resource
  // regardless of whether new information was found

  if (!isExtensionIncluded) {
    delete combined.extension;
  } else if ("extension" in r1) {
    combined.extension = [...r1.extension, extensionRef];
  } else {
    combined.extension = [extensionRef];
  }
  return combined;
}

// TODO: Might be a good idea to include a check to see if all resources refer to the same patient
const conditionKeysToIgnore = ["id", "resourceType", "subject"];

//eslint-disable-next-line @typescript-eslint/no-explicit-any
export function deepMerge(target: any, source: any, isExtensionIncluded: boolean): any {
  const combined = cloneDeep(target);
  for (const key of Object.keys(source)) {
    if (key === "extension" && !isExtensionIncluded) continue;
    if (conditionKeysToIgnore.includes(key)) continue;

    if (Array.isArray(source[key]) && Array.isArray(combined[key])) {
      // Combine arrays and remove duplicates based on unique properties
      combined[key] = mergeArrays(combined[key], source[key]);
    } else if (source[key] instanceof Object && key in combined) {
      // Recursively merge objects
      combined[key] = deepMerge(combined[key], source[key], isExtensionIncluded);
    } else {
      // Directly assign values
      if (key === "__proto__" || key === "constructor") continue;
      combined[key] = source[key];
    }
  }
  return combined;
}

//eslint-disable-next-line @typescript-eslint/no-explicit-any
export function mergeArrays(targetArray: any[], sourceArray: any[]): any[] {
  const combinedArray = cloneDeep(targetArray);

  for (const sourceItem of sourceArray) {
    const duplicate = combinedArray.find(
      targetItem => JSON.stringify(targetItem) === JSON.stringify(sourceItem)
    );

    if (!duplicate) {
      combinedArray.push(sourceItem);
    }
  }

  return combinedArray;
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
 * Fills in existing maps.
 */
export function fillMaps<T extends Resource>(
  map: Map<string, T>,
  key: string,
  targetResource: T,
  refReplacementMap: Map<string, string[]>,
  isExtensionIncluded = true,
  applySpecialModifications?: ApplySpecialModificationsCallback<T>
): void {
  const existingResource = map.get(key);
  if (existingResource?.id) {
    const masterRef = `${existingResource.resourceType}/${existingResource.id}`;
    let merged = combineTwoResources(existingResource, targetResource, isExtensionIncluded);
    if (applySpecialModifications) {
      merged = applySpecialModifications(merged, existingResource, targetResource);
    }
    map.set(key, merged);

    const existingReplacementIds = refReplacementMap.get(masterRef);
    if (targetResource.id) {
      const consumedRef = `${targetResource.resourceType}/${targetResource.id}`;
      if (existingReplacementIds) {
        refReplacementMap.set(masterRef, [...existingReplacementIds, consumedRef]);
      } else {
        refReplacementMap.set(masterRef, [consumedRef]);
      }
    }
  } else {
    map.set(key, targetResource);
  }
}

export function createKeysFromObjectArrayAndFlagBits(
  baseObject: object,
  contactsOrAddresses: (ContactPoint | Address)[],
  flagBits: number[]
): string[] {
  return contactsOrAddresses.map(item => JSON.stringify({ baseObject, ...item, flagBits }));
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
  applySpecialModifications,
}: {
  map1: Map<string, string>;
  map2: Map<string, T>;
  getterKeys: string[];
  setterKeys: string[];
  targetResource: T;
  refReplacementMap: Map<string, string[]>;
  isExtensionIncluded?: boolean;
  applySpecialModifications?: ApplySpecialModificationsCallback<T>;
}): void {
  let uuid = undefined;
  for (const key of getterKeys) {
    uuid = map1.get(key); // Potential improvement. We just select the first uuid that matches. What if multple matches exist?
    if (uuid) {
      fillMaps(
        map2,
        uuid,
        targetResource,
        refReplacementMap,
        isExtensionIncluded,
        applySpecialModifications
      );
      break;
    }
  }
  if (!uuid) {
    uuid = uuidv4();
    for (const key of setterKeys) {
      map1.set(key, uuid);
    }
    // fill L2 map only once to avoid duplicate entries
    fillMaps(
      map2,
      uuid,
      targetResource,
      refReplacementMap,
      isExtensionIncluded,
      applySpecialModifications
    );
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
    if (coding.code !== UNK_CODE && coding.display !== UNKNOWN_DISPLAY) {
      return coding.display;
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
  const code = coding.code?.trim().toLowerCase();
  const display = coding.display?.trim().toLowerCase();

  if (code) {
    return (
      code?.includes(unknownCoding.code.toLowerCase()) &&
      (!display || display === unknownCoding.display.toLowerCase()) &&
      (!text || text === unknownCode.text.toLowerCase())
    );
  } else {
    return (
      (!display || display === unknownCoding.display.toLowerCase()) &&
      (!text || text === unknownCode.text.toLowerCase())
    );
  }
}

export type DeduplicationResult<T extends Resource> = {
  combinedResources: T[];
  refReplacementMap: Map<string, string[]>;
  danglingReferences: string[];
};
