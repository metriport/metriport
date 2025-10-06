import { CodeableConcept } from "@medplum/fhirtypes";
import { SNOMED_URL } from "@metriport/shared/medical";

// https://hl7.org/fhir/R4/valueset-procedure-category.html
export const PROCEDURE_CATEGORY_NAMES = [
  "Psychiatry procedure or service",
  "Counselling",
  "Education",
  "Surgical procedure",
  "Diagnostic procedure",
  "Chiropractic manipulation",
  "Social service procedure",
] as const;
export type ProcedureCategoryName = (typeof PROCEDURE_CATEGORY_NAMES)[number];

export const PROCEDURE_CATEGORY_SNOMED_CODE: Record<ProcedureCategoryName, string> = {
  "Psychiatry procedure or service": "24642003",
  Counselling: "409063005",
  Education: "409073007",
  "Surgical procedure": "387713003",
  "Diagnostic procedure": "103693007",
  "Chiropractic manipulation": "46947000",
  "Social service procedure": "410606002",
};

export function getProcedureCategory(categoryName: ProcedureCategoryName): CodeableConcept {
  return {
    coding: [
      {
        system: SNOMED_URL,
        code: PROCEDURE_CATEGORY_SNOMED_CODE[categoryName],
        display: categoryName,
      },
    ],
  };
}
