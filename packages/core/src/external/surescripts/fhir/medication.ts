import { Medication, MedicationIngredient, Coding } from "@medplum/fhirtypes";
import { FlatFileDetail } from "../schema/response";

import { DEA_SCHEDULE_NAME } from "../codes";

export function getMedication(detail: FlatFileDetail): Medication {
  const code = getMedicationCode(detail);
  const ingredient = getMedicationIngredient(detail);

  return {
    resourceType: "Medication",
    ...(code ? { code } : null),
    ...(ingredient && ingredient.length > 0 ? { ingredient } : undefined),
  };
}

function getMedicationCode(detail: FlatFileDetail): Medication["code"] {
  if (!detail.ndcNumber) return undefined;

  const text = detail.drugDescription;
  const ndcCode = getMedicationNdcCode(detail);
  const productCode = getMedicationProductCode(detail);
  const deaCode = getMedicationDeaScheduleCode(detail);
  const coding = [ndcCode, productCode, deaCode].filter(Boolean) as Coding[];
  return {
    ...(text ? { text } : undefined),
    coding,
  };
}

function getMedicationNdcCode(detail: FlatFileDetail): Coding | undefined {
  if (!detail.ndcNumber) return undefined;
  return {
    system: "http://hl7.org/fhir/sid/ndc",
    code: detail.ndcNumber,
  };
}

function getMedicationProductCode(detail: FlatFileDetail): Coding | undefined {
  if (!detail.productCode) return undefined;
  // + detail.productCodeQualifier

  return {
    system: "http://hl7.org/fhir/sid/ndc",
    code: detail.productCode,
  };
}

function getMedicationDeaScheduleCode(detail: FlatFileDetail): Coding | undefined {
  if (!detail.deaSchedule) return undefined;
  return {
    system: "http://terminology.hl7.org/CodeSystem/v3-substanceAdminSubstitution",
    code: detail.deaSchedule,
    display: detail.deaSchedule ? DEA_SCHEDULE_NAME[detail.deaSchedule] : "",
  };
}

function getMedicationIngredient(detail: FlatFileDetail): MedicationIngredient[] | undefined {
  if (!detail.strengthValue || !detail.strengthFormCode || !detail.strengthUnitOfMeasure)
    return undefined;

  return [
    {
      strength: {
        numerator: {
          value: Number(detail.strengthValue),
          system: "http://ncicb.nci.nih.gov/xml/owl/EVS/Thesaurus.owl",
          code: detail.strengthUnitOfMeasure,
        },
        denominator: {
          value: 1,
        },
      },
    },
  ];
}
