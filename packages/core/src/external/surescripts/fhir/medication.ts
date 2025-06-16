import {
  Medication,
  MedicationIngredient,
  CodeableConcept,
  Coding,
  Ratio,
  MedicationBatch,
} from "@medplum/fhirtypes";
import { ResponseDetail } from "../schema/response";
import { uuidv7 } from "@metriport/shared/util/uuid-v7";

import { DeaScheduleName } from "@metriport/shared/interface/external/surescripts/dea-schedule";

export function getMedication(detail: ResponseDetail): Medication {
  const code = getMedicationCodeableConcept(detail);
  const ingredient = getMedicationIngredient(detail);
  const form = getMedicationForm(detail);
  const amount = getMedicationAmount(detail);
  const batch = getMedicationBatch(detail);

  return {
    resourceType: "Medication",
    id: uuidv7(),
    status: "active",
    ...(code ? { code } : undefined),
    ...(ingredient && ingredient.length > 0 ? { ingredient } : undefined),
    ...(form ? { form } : undefined),
    ...(amount ? { amount } : undefined),
    ...(batch ? { batch } : undefined),
  };
}

function getMedicationCodeableConcept(detail: ResponseDetail): CodeableConcept | undefined {
  const text = getMedicationText(detail);
  const coding = getMedicationCoding(detail);
  if (text && coding) return { text, coding };
  if (text) return { text };
  if (coding) return { coding };
  return undefined;
}

function getMedicationText(detail: ResponseDetail): string | undefined {
  if (!detail.drugDescription) return undefined;
  return detail.drugDescription;
}

function getMedicationCoding(detail: ResponseDetail): Coding[] | undefined {
  if (!detail.ndcNumber && !detail.productCode && !detail.deaSchedule) return undefined;

  const ndcCode = getMedicationNdcCode(detail);
  const productCode = getMedicationProductCode(detail);
  const deaCode = getMedicationDeaScheduleCode(detail);
  const coding = [ndcCode, productCode, deaCode].filter(Boolean) as Coding[];

  return coding;
}

function getMedicationNdcCode(detail: ResponseDetail): Coding | undefined {
  if (!detail.ndcNumber) return undefined;
  return {
    system: "http://hl7.org/fhir/sid/ndc",
    code: detail.ndcNumber,
    display: detail.drugDescription ?? "",
  };
}

function getMedicationProductCode(detail: ResponseDetail): Coding | undefined {
  if (!detail.productCode) return undefined;
  return {
    system: "http://hl7.org/fhir/sid/ndc",
    code: detail.productCode,
    display: detail.drugDescription ?? "",
  };
}

function getMedicationDeaScheduleCode(detail: ResponseDetail): Coding | undefined {
  if (!detail.deaSchedule) return undefined;
  return {
    system: "http://terminology.hl7.org/CodeSystem/v3-substanceAdminSubstitution",
    code: detail.deaSchedule,
    display: DeaScheduleName[detail.deaSchedule] ?? "",
  };
}

function getMedicationForm(detail: ResponseDetail): Coding | undefined {
  if (!detail.strengthFormCode) return undefined;
  return {
    system: "http://snomed.info/sct",
    code: detail.strengthFormCode,
    display: detail.strengthFormCode,
  };
}

function getMedicationAmount(detail: ResponseDetail): Ratio | undefined {
  if (!detail.quantityDispensed || !detail.quantityUnitOfMeasure) return undefined;

  return {
    numerator: {
      value: Number(detail.quantityDispensed),
      unit: detail.quantityUnitOfMeasure,
    },
    denominator: {
      value: 1,
      unit: "1",
    },
  };
}

function getMedicationBatch(detail: ResponseDetail): MedicationBatch | undefined {
  if (!detail.lastFilledDate || !detail.prescriptionNumber) return undefined;

  return {
    lotNumber: detail.prescriptionNumber,
    expirationDate: detail.endDate?.toISOString() ?? "",
  };
}

function getMedicationIngredient(detail: ResponseDetail): MedicationIngredient[] | undefined {
  if (!detail.strengthValue || !detail.strengthFormCode || !detail.strengthUnitOfMeasure)
    return undefined;

  return [
    {
      itemCodeableConcept: {
        coding: [
          {
            system: "http://snomed.info/sct",
            code: detail.drugDatabaseCode ?? "",
            display: detail.drugDescription ?? "",
          },
        ],
      },
      strength: {
        numerator: {
          value: Number(detail.strengthValue),
          system: "http://unitsofmeasure.org",
          code: detail.strengthUnitOfMeasure,
        },
        denominator: {
          value: 1,
          unit: detail.strengthFormCode,
          system: "http://unitsofmeasure.org",
          code: detail.strengthFormCode,
        },
      },
    },
  ];
}
