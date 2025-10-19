import { CodeableConcept, Coding, Condition, Encounter } from "@medplum/fhirtypes";
import { toTitleCase } from "@metriport/shared/common/title-case";
import {
  CONDITION_CATEGORY_SYSTEM_URL,
  CONDITION_CLINICAL_STATUS_URL,
  ICD_10_URL,
  SNOMED_URL,
} from "@metriport/shared/medical";
import { isUnknownCoding } from "../../../../fhir-deduplication/shared";
import { capture } from "../../../../util/notifications";
import { crosswalkCode } from "../../../term-server";

export const PROBLEM_LIST_CATEGORY_CODE = "problem-list-item";
export const PROBLEM_LIST_CATEGORY_DISPLAY = "Problem List Item";
export const ENCOUNTER_DIAGNOSIS_CATEGORY_CODE = "encounter-diagnosis";
export const ENCOUNTER_DIAGNOSIS_CATEGORY_DISPLAY = "Encounter Diagnosis";

/**
 * Map of clinical status found in the wild to HL7 codes.
 *
 * @see https://www.hl7.org/fhir/R4/valueset-condition-clinical.html
 */
const clinicalStatusCodeToHl7CodeMap: Record<string, string> = {
  "55561003": "active",
  active: "active",
  "73425007": "inactive",
  inactive: "inactive",
  "246455001": "recurrence",
  "255227004": "recurrence",
  "277022003": "remission",
  "413322009": "resolved",
  resolved: "resolved",
};

const knownBlacklistedClinicalStatuses = ["w"];

/**
 * This function hydrates the Condition resources by
 * - crosswalking the SNOMED code to the ICD-10 code
 * - adding the HL7 clinical status code to the Condition.clinicalStatus
 * - adding the HL7 category to the Condition.category
 */
export async function dangerouslyHydrateCondition(
  condition: Condition,
  encounters: Encounter[],
  patientId?: string | undefined
): Promise<void> {
  await dangerouslyHydrateCode(condition);

  checkClinicalStatusCodes(condition.clinicalStatus, patientId);
  const updatedClinicalStatus = buildUpdatedClinicalStatus(condition.clinicalStatus);
  if (updatedClinicalStatus) condition.clinicalStatus = updatedClinicalStatus;

  const updatedCategory = buildUpdatedCategory(condition, encounters);
  if (updatedCategory) {
    condition.category = updatedCategory;
  } else {
    delete condition.category;
  }
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

  if (!condition.code) {
    condition.code = { coding: [icd10Code] };
  } else if (!condition.code.coding || condition.code.coding.length === 0) {
    condition.code.coding = [icd10Code];
  } else {
    condition.code.coding.push(icd10Code);
  }
  return;
}

function checkClinicalStatusCodes(
  clinicalStatus: CodeableConcept | undefined,
  patientId: string | undefined
): void {
  for (const coding of clinicalStatus?.coding ?? []) {
    const code = coding.code?.toLowerCase()?.trim();
    if (
      code &&
      !clinicalStatusCodeToHl7CodeMap[code] &&
      !knownBlacklistedClinicalStatuses.includes(code)
    ) {
      capture.message("Unknown Condition.clinicalStatus code", {
        level: "warning",
        extra: {
          unknownCode: code,
          system: coding.system,
          display: coding.display,
          patientId,
        },
      });
    }
  }
}

export function buildUpdatedClinicalStatus(
  existingStatus: CodeableConcept | undefined
): CodeableConcept | undefined {
  if (!existingStatus) return undefined;

  const validStatusCodings = existingStatus.coding?.filter(coding => {
    const code = coding.code?.toLowerCase()?.trim();
    if (!code) return false;
    return clinicalStatusCodeToHl7CodeMap[code] || !knownBlacklistedClinicalStatuses.includes(code);
  });

  if (!validStatusCodings || validStatusCodings.length < 1) return undefined;

  const validExistingStatus = {
    ...existingStatus,
    coding: validStatusCodings,
  };

  if (
    validExistingStatus.coding?.some(
      coding => coding.system === CONDITION_CLINICAL_STATUS_URL && coding.code
    )
  ) {
    return validExistingStatus;
  }

  const hl7ClinicalStatusCoding = buildHl7ClinicalStatusCoding(validStatusCodings);
  if (!hl7ClinicalStatusCoding) return validExistingStatus;

  return {
    ...validExistingStatus,
    // Add the HL7 code to the top of the coding array
    coding: [hl7ClinicalStatusCoding, ...(validExistingStatus.coding ?? [])],
  };
}

function buildHl7ClinicalStatusCoding(codings: Coding[]): Coding | undefined {
  for (const coding of codings) {
    const code = coding.code?.toLowerCase()?.trim();
    if (!code) continue;

    const hl7Code = clinicalStatusCodeToHl7CodeMap[code];
    if (hl7Code) {
      return {
        system: CONDITION_CLINICAL_STATUS_URL,
        code: hl7Code,
        display: toTitleCase(hl7Code),
      };
    }
  }

  return undefined;
}

function buildUpdatedCategory(
  condition: Condition,
  encounters: Encounter[]
): CodeableConcept[] | undefined {
  if (
    condition.category?.find(c =>
      c.coding?.find(coding => coding.system === CONDITION_CATEGORY_SYSTEM_URL)
    )
  ) {
    return condition.category;
  }

  const hl7Category = buildHl7CategoryBasedOnHeuristics(condition, encounters);

  // We specifically put the Hl7 category into a separate element of the category
  // array because its semantic meaning is likely different from other systems' categories.
  const categories = [
    hl7Category ? { coding: [hl7Category] } : undefined,
    ...(condition.category ?? []),
  ].filter(Boolean) as CodeableConcept[];

  return categories.length > 0 ? categories : undefined;
}

/**
 * Decides the condition category based on the following heuristics:
 *
 * 1. If any Condition.code text or display contains words "history of", it's a problem-list-item.
 * 2. If there's an ICD-10 code that starts with a Z, it's a problem-list-item.
 * 3. If Encounter.diagnosis references the Condition, it's an encounter-diagnosis.
 */
function buildHl7CategoryBasedOnHeuristics(
  condition: Condition,
  encounters: Encounter[]
): Coding | undefined {
  if (isHistoryDisplay(condition.code?.text) || isProblemListIcd10Code(condition.code)) {
    return buildConditionCategoryCoding(PROBLEM_LIST_CATEGORY_CODE, PROBLEM_LIST_CATEGORY_DISPLAY);
  }

  const isEncounterDiagnosis = encounters.some(encounter =>
    encounter.diagnosis?.some(diagnosis => {
      if (!condition.id) return false;
      const ref = diagnosis.condition?.reference;
      return ref === `Condition/${condition.id}` || ref?.endsWith(`/${condition.id}`);
    })
  );

  if (isEncounterDiagnosis) {
    return buildConditionCategoryCoding(
      ENCOUNTER_DIAGNOSIS_CATEGORY_CODE,
      ENCOUNTER_DIAGNOSIS_CATEGORY_DISPLAY
    );
  }

  return undefined;
}

function isHistoryDisplay(display: string | undefined): boolean {
  if (!display) return false;
  return display.toLowerCase().includes("history of") || display.toLowerCase().includes("hx of");
}

function isProblemListIcd10Code(code: CodeableConcept | undefined): boolean {
  if (!code) return false;
  return (
    code.coding?.some(coding => coding.system === ICD_10_URL && coding.code?.startsWith("Z")) ??
    false
  );
}

function buildConditionCategoryCoding(code: string, display: string): Coding {
  return {
    system: CONDITION_CATEGORY_SYSTEM_URL,
    code,
    display,
  };
}
