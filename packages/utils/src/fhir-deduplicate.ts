import * as dotenv from "dotenv";
dotenv.config();
// keep that ^ on top
import {
  AllergyIntolerance,
  Bundle,
  Condition,
  Coverage,
  DiagnosticReport,
  Encounter,
  Extension,
  FamilyMemberHistory,
  Immunization,
  Location,
  Medication,
  MedicationStatement,
  Observation,
  Organization,
  Patient,
  Practitioner,
  Procedure,
  RelatedPerson,
} from "@medplum/fhirtypes";
import fs from "fs";
import { cloneDeep } from "lodash";

const ISO_DATE = "YYYY-MM-DD";
const RX_NORM_CODE = "rxnorm";
const NDC_CODE = "ndc";
const SNOMED_CODE = "snomed";
const ICD_10_CODE = "icd-10";
const ICD_9_CODE = "icd-9";
const LOINC_CODE = "loinc";
const MEDICARE_CODE = "medicare";
const CPT_CODE = "cpt";
const IMO_CODE = "imo";
const UNK_CODE = "UNK";
const UNKNOWN_DISPLAY = "unknown";

type CompositeKey = {
  code: string;
  date: string;
};

// common code systems
const NUCC_SYSTEM = "nucc";
const US_NPI_SYSTEM = "npi";

function extractFhirTypesFromBundle(bundle: Bundle): {
  diagnosticReports: DiagnosticReport[];
  patient?: Patient | undefined;
  practitioners: Practitioner[];
  medications: Medication[];
  medicationStatements: MedicationStatement[];
  conditions: Condition[];
  allergies: AllergyIntolerance[];
  locations: Location[];
  procedures: Procedure[];
  observationSocialHistory: Observation[];
  observationVitals: Observation[];
  observationLaboratory: Observation[];
  observationOther: Observation[];
  encounters: Encounter[];
  immunizations: Immunization[];
  familyMemberHistories: FamilyMemberHistory[];
  relatedPersons: RelatedPerson[];
  coverages: Coverage[];
  organizations: Organization[];
} {
  let patient: Patient | undefined;
  const practitioners: Practitioner[] = [];
  const diagnosticReports: DiagnosticReport[] = [];
  const medicationStatements: MedicationStatement[] = [];
  const medications: Medication[] = [];
  const conditions: Condition[] = [];
  const allergies: AllergyIntolerance[] = [];
  const locations: Location[] = [];
  const procedures: Procedure[] = [];
  const observationSocialHistory: Observation[] = [];
  const observationVitals: Observation[] = [];
  const observationLaboratory: Observation[] = [];
  const observationOther: Observation[] = [];
  const encounters: Encounter[] = [];
  const immunizations: Immunization[] = [];
  const familyMemberHistories: FamilyMemberHistory[] = [];
  const relatedPersons: RelatedPerson[] = [];
  const coverages: Coverage[] = [];
  const organizations: Organization[] = [];

  if (bundle.entry) {
    for (const entry of bundle.entry) {
      const resource = entry.resource;
      if (resource?.resourceType === "Patient") {
        patient = resource as Patient;
      } else if (resource?.resourceType === "MedicationStatement") {
        medicationStatements.push(resource as MedicationStatement);
      } else if (resource?.resourceType === "Medication") {
        medications.push(resource as Medication);
      } else if (resource?.resourceType === "Condition") {
        conditions.push(resource as Condition);
      } else if (resource?.resourceType === "Location") {
        locations.push(resource as Location);
      } else if (resource?.resourceType === "AllergyIntolerance") {
        allergies.push(resource as AllergyIntolerance);
      } else if (resource?.resourceType === "Procedure") {
        procedures.push(resource as Procedure);
      } else if (resource?.resourceType === "Observation") {
        const observation = resource as Observation;
        const isVitalSigns = observation.category?.find(
          ext => ext.coding?.[0]?.code?.toLowerCase() === "vital-signs"
        );
        const isSocialHistory = observation.category?.find(
          ext => ext.coding?.[0]?.code?.toLowerCase() === "social-history"
        );
        const isLaboratory = observation.category?.find(
          category => category.coding?.[0]?.code?.toLowerCase() === "laboratory"
        );
        const stringifyResource = JSON.stringify(resource);

        if (stringifyResource && isVitalSigns) {
          observationVitals.push(observation);
        } else if (stringifyResource && isLaboratory) {
          observationLaboratory.push(observation);
        } else if (stringifyResource && isSocialHistory) {
          observationSocialHistory.push(observation);
        } else {
          observationOther.push(observation);
        }
      } else if (resource?.resourceType === "Encounter") {
        encounters.push(resource as Encounter);
      } else if (resource?.resourceType === "Immunization") {
        immunizations.push(resource as Immunization);
      } else if (resource?.resourceType === "FamilyMemberHistory") {
        familyMemberHistories.push(resource as FamilyMemberHistory);
      } else if (resource?.resourceType === "RelatedPerson") {
        relatedPersons.push(resource as RelatedPerson);
      } else if (resource?.resourceType === "Coverage") {
        coverages.push(resource as Coverage);
      } else if (resource?.resourceType === "DiagnosticReport") {
        diagnosticReports.push(resource as DiagnosticReport);
      } else if (resource?.resourceType === "Practitioner") {
        practitioners.push(resource as Practitioner);
      } else if (resource?.resourceType === "Organization") {
        organizations.push(resource as Organization);
      }
    }
  }

  return {
    patient,
    practitioners,
    diagnosticReports,
    medications,
    medicationStatements,
    conditions,
    allergies,
    locations,
    procedures,
    observationSocialHistory,
    observationVitals,
    observationLaboratory,
    observationOther,
    encounters,
    immunizations,
    familyMemberHistories,
    relatedPersons,
    coverages,
    organizations,
  };
}

async function summarizeFHIR() {
  // read bundle from file
  const fileName =
    "/Users/ramilgaripov/Documents/phi/testingFiles/conditionsDedup/only-conditions-50.json";
  const fhirBundleStr = fs.readFileSync(fileName, { encoding: "utf8" });

  // ------------------------------------------------------------------
  // Step 1:
  //    Split FHIR bundle into separate arrays of resource types
  // ------------------------------------------------------------------
  const fhirBundle: Bundle = JSON.parse(fhirBundleStr);
  const {
    patient,
    practitioners,
    diagnosticReports, // 2
    medications, // 1
    medicationStatements, // 1
    // also medicationRequests
    // also medicationAdministration
    conditions, // 1
    allergies, // 4
    locations,
    procedures, // 4
    observationOther,
    observationSocialHistory, // 4
    observationVitals, // 4
    observationLaboratory, // 1
    encounters, // 2
    immunizations, // 4
    familyMemberHistories, // 4
    relatedPersons,
    coverages,
    organizations,
  } = extractFhirTypesFromBundle(fhirBundle);

  // ------------------------------------------------------------------
  // Step 2:
  //    For each resource array:
  //      Build map of unique keys to array of similar resource ids
  //      Find the master resource - this will be the most populated one
  //      Decide:
  //        Create new resource, ultra master, based off the master;
  //        Or, merge everything into the master
  //      Merge all other resources into the (ultra) master, and preserve list of source resources
  // ------------------------------------------------------------------

  // Build map of unique keys to array of similar resource ids
  // const conditionKeyToResourceIds: { [index: string]: string[] } = {};

  const deduplicatedConditions = deduplicateConditions(conditions);
  console.log(
    `Was: ${conditions.length}, now: ${deduplicatedConditions.length} deduped conditions.`
  );
}

/**
 * Approach:
 * 1. Sort Conditions - put the ones with the largest number of codes first
 * 2. Group same Conditions based on:
 *      - Medical codes
 *      - Date
 * 3. Combine the Conditions in each group into one master condition and return the array of only unique and maximally filled out Conditions
 */
function deduplicateConditions(conditions: Condition[]): Condition[] {
  const sortedByCodes = sortByCodeLengths(conditions);
  const groupedConditionsMap = groupSameConditions(sortedByCodes);
  return combineSameConditions(groupedConditionsMap);
}

function sortByCodeLengths(conditions: Condition[]): Condition[] {
  return conditions.sort((a, b) => {
    const lengthA = a.code?.coding?.length || 0;
    const lengthB = b.code?.coding?.length || 0;

    if (lengthA > lengthB) return -1;
    if (lengthA < lengthB) return 1;
    return 0;
  });
}

function groupSameConditions(conditions: Condition[]): Map<CompositeKey, Condition[]> {
  const conditionMap = new Map<CompositeKey, Condition[]>();
  for (const condition of conditions) {
    const newKey = createCompositeKey(condition);

    const existingKey = getExistingKey(conditionMap, newKey);
    if (!existingKey) {
      conditionMap.set(newKey, [condition]);
    } else {
      const mappedConditions = conditionMap.get(existingKey);
      if (mappedConditions) conditionMap.set(existingKey, [...mappedConditions, condition]);
    }
  }
  return conditionMap;
}

function createCompositeKey(condition: Condition): CompositeKey {
  const codeKey = createKeyFromCodes(condition);
  const dateKey = createDateKey(condition);

  return {
    code: codeKey,
    date: dateKey,
  };
}

const relevantCodeSystems = [SNOMED_CODE, ICD_10_CODE, ICD_9_CODE, LOINC_CODE, CPT_CODE, IMO_CODE];

function createKeyFromCodes(condition: Condition): string {
  const concept = condition.code;
  let codeKey = "";
  if (concept && concept.coding) {
    for (const coding of concept.coding) {
      const system = coding.system?.trim().toLowerCase();
      const code = coding.code?.trim().toLowerCase();
      if (system && code) {
        // TODO: Decide whether other codes should also be included
        for (const codeSystem of relevantCodeSystems) {
          if (system.includes(codeSystem)) codeKey += code + "/";
        }
      }
    }
  }
  if (codeKey.length === 0) {
    const msg = "Specified codes not found for Condition";
    console.error(`${msg}: ${condition.id}`);
    // TODO: Preserve all conditions where the code key is empty
  }
  return codeKey;
}

function createDateKey(condition: Condition): string {
  if (condition.onsetPeriod?.start) {
    return getDateFromString(condition.onsetPeriod?.start);
  }

  // TODO: See what other condition attributes we encounter and account for those. For now, keeping the error for vis
  const msg = "Start time not found in onsetPeriod. Check other attributes of Condition";
  console.log(`${msg}: ${condition.id}`);
  throw new Error(msg);
}

function getDateFromString(dateString: string): string {
  const date = new Date(dateString);
  return date.toLocaleDateString();
}

function getExistingKey<T>(
  map: Map<CompositeKey, T>,
  targetFullKey: CompositeKey
): CompositeKey | undefined {
  for (const fullMapKey of map.keys()) {
    // TODO: Let's not be so strict on the date. If conditions are recorded within a week of each other, might be good to consider them the same record
    if (fullMapKey.date !== targetFullKey.date) continue;
    const splitMapKey = fullMapKey.code.split("/");
    const splitKey = targetFullKey.code.split("/");
    if (
      splitKey.some(k => {
        const trimmedK = k.trim();
        if (trimmedK.length) {
          return splitMapKey.includes(k);
        }
      })
    ) {
      return fullMapKey;
    }
  }
  return undefined;
}

function combineSameConditions(map: Map<CompositeKey, Condition[]>): Condition[] {
  const uniqueConditions = new Set<Condition>();
  const groupKeys = map.keys();
  for (const groupKey of groupKeys) {
    const conditions = map.get(groupKey);

    if (!conditions) throw new Error("NO CONDITIONS FOUND! SOMETHING MUST'VE GONE WRONG UPSTREAM");

    // TODO: Might be a good idea to select the most informative condition to be the master condition
    let masterCondition = conditions[0];
    const extensions: Extension[] = [
      createExtensionReference(masterCondition.resourceType, masterCondition.id),
    ];

    // This part combines conditions together and adds the ID references of the duplicates into the master condition (regardless of whether new information was found)
    for (const condition of conditions.slice(1)) {
      masterCondition = combineTwoConditions(masterCondition, condition);
      extensions.push(createExtensionReference(condition.resourceType, condition.id));
    }

    masterCondition.extension = [...(masterCondition.extension || []), ...extensions];
    uniqueConditions.add(masterCondition);
  }

  return Array.from(uniqueConditions);
}

function createExtensionReference(resourceType: string, id: string | undefined) {
  return {
    url: "http://example.org/fhir/StructureDefinition/original-resource",
    valueReference: { reference: `${resourceType}/${id}` },
  };
}

function combineTwoConditions(c1: Condition, c2: Condition): Condition {
  return deepMerge({ ...c1 }, c2);
}

// TODO: Might be a good idea to include a check to see if all resources refer to the same patient
const conditionKeysToIgnore = ["id", "resourceType", "subject"];

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

summarizeFHIR();
