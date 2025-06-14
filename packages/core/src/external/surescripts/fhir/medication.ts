import { Medication, MedicationIngredient, Coding } from "@medplum/fhirtypes";
import { ResponseDetail } from "../schema/response";

import { DEA_SCHEDULE_NAME } from "@metriport/shared/interface/external/surescripts/dea-schedule";

export function getMedication(detail: ResponseDetail): Medication {
  const code = getMedicationCode(detail);
  const ingredient = getMedicationIngredient(detail);

  return {
    resourceType: "Medication",
    ...(code ? { code } : null),
    ...(ingredient && ingredient.length > 0 ? { ingredient } : undefined),
  };
}

function getMedicationCode(detail: ResponseDetail): Medication["code"] {
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

function getMedicationNdcCode(detail: ResponseDetail): Coding | undefined {
  if (!detail.ndcNumber) return undefined;
  return {
    system: "http://hl7.org/fhir/sid/ndc",
    code: detail.ndcNumber,
  };
}

function getMedicationProductCode(detail: ResponseDetail): Coding | undefined {
  if (!detail.productCode) return undefined;
  // + detail.productCodeQualifier

  return {
    system: "http://hl7.org/fhir/sid/ndc",
    code: detail.productCode,
  };
}

function getMedicationDeaScheduleCode(detail: ResponseDetail): Coding | undefined {
  if (!detail.deaSchedule) return undefined;
  return {
    system: "http://terminology.hl7.org/CodeSystem/v3-substanceAdminSubstitution",
    code: detail.deaSchedule,
    display: detail.deaSchedule ? DEA_SCHEDULE_NAME[detail.deaSchedule] : "",
  };
}

function getMedicationIngredient(detail: ResponseDetail): MedicationIngredient[] | undefined {
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
