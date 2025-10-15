import { CodeableConcept, Coding, Condition, Encounter } from "@medplum/fhirtypes";
import { ICD_10_URL, SNOMED_URL } from "@metriport/shared/medical";
import { isUnknownCoding } from "../../../../fhir-deduplication/shared";
import { crosswalkCode } from "../../../term-server";

export const CONDITION_CATEGORY_SYSTEM_URL =
  "http://terminology.hl7.org/CodeSystem/condition-category";
export const PROBLEM_LIST_CATEGORY_CODE = "problem-list-item";
export const ENCOUNTER_DIAGNOSIS_CATEGORY_CODE = "encounter-diagnosis";

/**
 * This function hydrates the condition by crosswalking the SNOMED code to the ICD-10 code
 * if it doesn't already have an ICD-10 code.
 */
export async function dangerouslyHydrateCondition(
  condition: Condition,
  encounters: Encounter[]
): Promise<void> {
  await dangerouslyHydrateCode(condition);

  const categories = buildUpdatedCategory(condition, encounters);
  condition.category = categories;
}

async function dangerouslyHydrateCode(condition: Condition): Promise<void> {
  const snomedCode = condition.code?.coding?.find(coding => coding.system === SNOMED_URL);
  if (!snomedCode || !snomedCode.code) return;

  const existingIcd10Code = condition.code?.coding?.find(coding => coding.system === ICD_10_URL);
  if (existingIcd10Code && !isUnknownCoding(existingIcd10Code)) return;

  const icd10Code = await crosswalkCode({
    sourceCode: snomedCode.code,
    sourceSystem: SNOMED_URL,
    targetSystem: ICD_10_URL,
  });
  if (!icd10Code) return;

  condition.code?.coding?.push(icd10Code);
  return;
}

function buildUpdatedCategory(condition: Condition, encounters: Encounter[]): CodeableConcept[] {
  if (
    condition.category?.find(c =>
      c.coding?.find(coding => coding.system === CONDITION_CATEGORY_SYSTEM_URL)
    )
  ) {
    return condition.category;
  }

  const newCategory = buildConditionCategoryBasedOnHeuristics(condition, encounters);
  const [firstCategory, ...restCategories] = condition.category ?? [];
  const combinedCategory = {
    ...firstCategory,
    coding: [newCategory, ...(firstCategory?.coding ?? [])],
  };

  return [combinedCategory, ...restCategories];
}

/**
 * Decides the condition category based on the following heuristics:
 *
 * 1. If any Condition.code text or display contains words "history of", it's a problem-list-item.
 * 2. If there's an ICD-10 code that starts with a Z, it's a problem-list-item.
 * 3. If Encounter.diagnosis references the Condition, it's an encounter-diagnosis.
 * 4. Default to problem-list-item.
 */
function buildConditionCategoryBasedOnHeuristics(
  condition: Condition,
  encounters: Encounter[]
): Coding {
  if (
    isHistoryDisplay(condition.code?.text) ||
    condition.code?.coding?.some(
      coding =>
        (coding.system === ICD_10_URL && coding.code?.startsWith("Z")) ||
        isHistoryDisplay(coding.display)
    )
  ) {
    return buildConditionCategoryCoding(PROBLEM_LIST_CATEGORY_CODE);
  }

  const isEncounterDiagnosis = encounters.some(encounter =>
    encounter.diagnosis?.some(
      diagnosis => condition.id && diagnosis.condition?.reference?.includes(condition.id)
    )
  );

  if (isEncounterDiagnosis) {
    return buildConditionCategoryCoding(ENCOUNTER_DIAGNOSIS_CATEGORY_CODE);
  }

  return buildConditionCategoryCoding(PROBLEM_LIST_CATEGORY_CODE);
}

function isHistoryDisplay(display: string | undefined): boolean {
  if (!display) return false;
  return display.toLowerCase().includes("history of") || display.toLowerCase().includes("hx of");
}

function buildConditionCategoryCoding(code: string): Coding {
  return {
    system: CONDITION_CATEGORY_SYSTEM_URL,
    code,
  };
}
