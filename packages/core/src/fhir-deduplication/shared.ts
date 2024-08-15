import { Resource } from "@medplum/fhirtypes";
import { cloneDeep } from "lodash";

export type CompositeKey = {
  code: string;
  date: string | undefined;
};

export function createCompositeKey(code: string, date: string | undefined): CompositeKey {
  return {
    code,
    date,
  };
}

export function getDateFromString(dateString: string): string {
  const date = new Date(dateString);
  return date.toLocaleDateString();
}

function createExtensionReference(resourceType: string, id: string | undefined) {
  return {
    url: "http://hl7.org/fhir/StructureDefinition/codesystem-sourceReference",
    sourceReference: { value: `${resourceType}/${id}` },
  };
}

export function combineTwoResources<T extends Resource>(
  r1: T,
  r2: T,
  isExtensionIncluded = true
): T {
  const combined = deepMerge({ ...r1 }, r2, isExtensionIncluded);
  const extensionRef = createExtensionReference(r2.resourceType, r2.id);

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
  for (const key of Object.keys(source)) {
    if (key === "extension" && !isExtensionIncluded) continue;
    if (conditionKeysToIgnore.includes(key)) continue;

    if (Array.isArray(source[key]) && Array.isArray(target[key])) {
      // Combine arrays and remove duplicates based on unique properties
      target[key] = mergeArrays(target[key], source[key]);
    } else if (source[key] instanceof Object && key in target) {
      // Recursively merge objects
      target[key] = deepMerge(target[key], source[key], isExtensionIncluded);
    } else {
      // Directly assign values
      if (key === "__proto__" || key === "constructor") continue;
      target[key] = source[key];
    }
  }
  return target;
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

export function combineResources<T>({
  combinedMaps,
  remainingResources,
}: {
  combinedMaps: Map<string, T>[];
  remainingResources: T[];
}): T[] {
  const combinedResources: T[] = [];
  for (const map of combinedMaps) {
    for (const condition of map.values()) {
      combinedResources.push(condition);
    }
  }
  combinedResources.push(...remainingResources);
  return combinedResources;
}

/**
 * Fills in existing maps.
 */
export function fillMaps<T extends Resource>(
  map: Map<string, T>,
  key: string,
  resource: T,
  refReplacementMap: Map<string, string[]>,
  isExtensionIncluded = true
): void {
  const existing = map.get(key);
  if (existing?.id) {
    const masterRef = `${existing.resourceType}/${existing.id}`;
    const merged = combineTwoResources(existing, resource, isExtensionIncluded);
    map.set(key, merged);

    const existingReplacementIds = refReplacementMap.get(masterRef);
    if (resource.id) {
      const consumedRef = `${resource.resourceType}/${resource.id}`;
      if (existingReplacementIds) {
        refReplacementMap.set(masterRef, [...existingReplacementIds, consumedRef]);
      } else {
        refReplacementMap.set(masterRef, [consumedRef]);
      }
    }
  } else {
    map.set(key, resource);
  }
}
