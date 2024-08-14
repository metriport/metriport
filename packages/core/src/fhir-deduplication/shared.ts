import { Condition } from "@medplum/fhirtypes";
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
// const RX_NORM_CODE = "rxnorm";
// const NDC_CODE = "ndc";

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

export function combineTwoResources(c1: Condition, c2: Condition): Condition {
  const combined = deepMerge({ ...c1 }, c2);
  const extensionRef = createExtensionReference(c2.resourceType, c2.id);

  // This part combines conditions together and adds the ID references of the duplicates into the master condition (regardless of whether new information was found)
  combined.extension = [...(c1.extension || []), extensionRef];
  return combined;
}

// TODO: Might be a good idea to include a check to see if all resources refer to the same patient
const conditionKeysToIgnore = ["id", "resourceType", "subject"];

//eslint-disable-next-line @typescript-eslint/no-explicit-any
export function deepMerge(target: any, source: any): any {
  for (const key of Object.keys(source)) {
    if (conditionKeysToIgnore.includes(key)) continue;

    if (Array.isArray(source[key]) && Array.isArray(target[key])) {
      // Combine arrays and remove duplicates based on unique properties
      target[key] = mergeArrays(target[key], source[key]);
    } else if (source[key] instanceof Object && key in target) {
      // Recursively merge objects
      target[key] = deepMerge(target[key], source[key]);
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
