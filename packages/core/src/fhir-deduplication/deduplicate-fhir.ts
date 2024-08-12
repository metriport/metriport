import { Bundle, BundleEntry, CodeableConcept, Condition, Resource } from "@medplum/fhirtypes";
import { cloneDeep } from "lodash";
import { extractFhirTypesFromBundle } from "../external/fhir/shared/bundle";

// Keeping these for future reference. We're likely going to use some of these with other resources
// const RX_NORM_CODE = "rxnorm";
// const NDC_CODE = "ndc";
const SNOMED_CODE = "snomed";
const SNOMED_OID = "2.16.840.1.113883.6.96";
const ICD_10_CODE = "icd-10";
const ICD_10_OID = "2.16.840.1.113883.6.90";
// const ICD_9_CODE = "icd-9";
// const LOINC_CODE = "loinc";
// const MEDICARE_CODE = "medicare";
// const CPT_CODE = "cpt";
// const IMO_CODE = "imo";

// common code systems
// const NUCC_SYSTEM = "nucc";
// const US_NPI_SYSTEM = "npi";

type CompositeKey = {
  code: string;
  date: string | undefined;
};

export function deduplicateFhir(fhirBundle: Bundle<Resource>): Bundle<Resource> {
  const resourceArrays = extractFhirTypesFromBundle(fhirBundle);
  const deduplicatedEntries: BundleEntry<Resource>[] = [];

  // Rebuild the entries with deduplicated resources and add whatever is left unprocessed
  for (const [key, resources] of Object.entries(resourceArrays)) {
    if (key === "conditions") {
      const deduplicatedConditions = deduplicateConditions(resourceArrays.conditions);
      deduplicatedEntries.push(...deduplicatedConditions);
    } else {
      // Push all other resources unchanged
      const entriesArray = resources && Array.isArray(resources) ? resources : [resources];
      const entriesFlat = entriesArray.flatMap(v => v || []);
      deduplicatedEntries.push(...entriesFlat);
    }
  }

  const deduplicatedBundle: Bundle = cloneDeep(fhirBundle);
  deduplicatedBundle.entry = deduplicatedEntries.map(
    r => ({ resource: r } as BundleEntry<Resource>)
  );
  deduplicatedBundle.total = deduplicatedEntries.length;

  return deduplicatedBundle;
}

/**
 * Approach:
 * 1. Group same Conditions based on:
 *      - Medical codes:
 *          - ICD-10, if possible
 *          // TODO: Introduce SNOMED cross-walk to match SNOMED with ICD-10
 *          - SNOMED, if possible
 *      - Date
 * 2. Combine the Conditions in each group into one master condition and return the array of only unique and maximally filled out Conditions
 */
function deduplicateConditions(conditions: Condition[]) {
  const { snomedMap, icd10Map, remainingConditions } = groupSameConditions(conditions);
  return combineConditions(snomedMap, icd10Map, remainingConditions);
}

function combineConditions(
  snomedMap: Map<string, Condition>,
  icd10Map: Map<string, Condition>,
  remainingConditions: Condition[]
): Condition[] {
  const combinedConditions: Condition[] = [];
  for (const condition of icd10Map.values()) {
    combinedConditions.push(condition);
  }
  for (const condition of snomedMap.values()) {
    combinedConditions.push(condition);
  }
  combinedConditions.push(...remainingConditions);
  return combinedConditions;
}

export function groupSameConditions(conditions: Condition[]): {
  icd10Map: Map<string, Condition>;
  snomedMap: Map<string, Condition>;
  remainingConditions: Condition[];
} {
  const snomedMap = new Map<string, Condition>();
  const icd10Map = new Map<string, Condition>();
  const remainingConditions: Condition[] = [];

  for (const condition of conditions) {
    const date = createDateKey(condition);
    const { snomedCode, icd10Code } = extractCodes(condition.code);

    if (icd10Code) {
      const compKey = JSON.stringify(createCompositeKey(icd10Code, date));
      const existingCondition = icd10Map.get(compKey);
      if (existingCondition) {
        const mergedCondition = combineTwoConditions(existingCondition, condition);
        icd10Map.set(compKey, mergedCondition);
      } else {
        icd10Map.set(compKey, condition);
      }
    } else if (snomedCode) {
      const compKey = JSON.stringify(createCompositeKey(snomedCode, date));
      const existingCondition = snomedMap.get(compKey);
      if (existingCondition) {
        const mergedCondition = combineTwoConditions(existingCondition, condition);
        snomedMap.set(compKey, mergedCondition);
      } else {
        snomedMap.set(compKey, condition);
      }
    } else {
      remainingConditions.push(condition);
    }
  }

  return { icd10Map, snomedMap, remainingConditions };
}

export function extractCodes(concept: CodeableConcept | undefined): {
  snomedCode: string | undefined;
  icd10Code: string | undefined;
} {
  let snomedCode = undefined;
  let icd10Code = undefined;
  if (!concept) return { snomedCode, icd10Code };

  if (concept && concept.coding) {
    for (const coding of concept.coding) {
      const system = coding.system?.toLowerCase();
      const code = coding.code?.trim().toLowerCase();
      if (system && code) {
        if (system.includes(SNOMED_CODE) || system.includes(SNOMED_OID)) {
          snomedCode = code;
        } else if (system.includes(ICD_10_CODE) || system.includes(ICD_10_OID)) {
          icd10Code = code;
        }
      }
    }
  }
  return { snomedCode, icd10Code };
}

function createCompositeKey(code: string, date: string | undefined): CompositeKey {
  return {
    code,
    date,
  };
}

function createDateKey(condition: Condition): string | undefined {
  if (condition.onsetPeriod?.start) {
    return getDateFromString(condition.onsetPeriod?.start);
  } else if (condition.onsetDateTime) {
    return getDateFromString(condition.onsetDateTime);
  }

  return undefined;
}

function getDateFromString(dateString: string): string {
  const date = new Date(dateString);
  return date.toLocaleDateString();
}

function createExtensionReference(resourceType: string, id: string | undefined) {
  return {
    url: "http://example.org/fhir/StructureDefinition/original-resource",
    valueReference: { reference: `${resourceType}/${id}` },
  };
}

export function combineTwoConditions(c1: Condition, c2: Condition): Condition {
  const combined = deepMerge({ ...c1 }, c2);
  const extensionRef = createExtensionReference(c2.resourceType, c2.id);

  // This part combines conditions together and adds the ID references of the duplicates into the master condition (regardless of whether new information was found)
  combined.extension = [...(c1.extension || []), extensionRef];
  return combined;
}

// TODO: Might be a good idea to include a check to see if all resources refer to the same patient
const conditionKeysToIgnore = ["id", "resourceType", "subject"];

//eslint-disable-next-line @typescript-eslint/no-explicit-any
function deepMerge(target: any, source: any): any {
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
      target[key] = source[key];
    }
  }
  return target;
}

//eslint-disable-next-line @typescript-eslint/no-explicit-any
function mergeArrays(targetArray: any[], sourceArray: any[]): any[] {
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
