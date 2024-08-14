import { Resource } from "@medplum/fhirtypes";
import { cloneDeep } from "lodash";

export type CompositeKey = {
  code: string;
  date: string | undefined;
};

export const SNOMED_CODE = "snomed";
export const SNOMED_OID = "2.16.840.1.113883.6.96";
export const ICD_10_CODE = "icd-10";
export const ICD_10_OID = "2.16.840.1.113883.6.90";

// Keeping these for future reference. We're likely going to use some of these with other resources
export const RXNORM_CODE = "rxnorm";
export const RXNORM_OID = "2.16.840.1.113883.6.88";

export const NDC_CODE = "ndc";
export const NDC_OID = "2.16.840.1.113883.6.69";

// const ICD_9_CODE = "icd-9";
// const LOINC_CODE = "loinc";
// const MEDICARE_CODE = "medicare";
// const CPT_CODE = "cpt";
// const IMO_CODE = "imo";

// common code systems
// const NUCC_SYSTEM = "nucc";
// const US_NPI_SYSTEM = "npi";

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
  idReplacementMap: Map<string, string[]>
): void {
  const existing = map.get(key);
  if (existing?.id) {
    const merged = combineTwoResources(existing, resource, false);
    map.set(key, merged);

    const existingReplacementIds = idReplacementMap.get(existing.id);
    if (resource.id) {
      if (existingReplacementIds) {
        idReplacementMap.set(existing.id, [...existingReplacementIds, resource.id]);
      } else {
        idReplacementMap.set(existing.id, [resource.id]);
      }
    }
  } else {
    map.set(key, resource);
  }
}
