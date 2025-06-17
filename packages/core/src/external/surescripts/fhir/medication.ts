import {
  Medication,
  MedicationIngredient,
  CodeableConcept,
  Coding,
  Ratio,
  MedicationBatch,
  Reference,
} from "@medplum/fhirtypes";
import { ResponseDetail } from "../schema/response";
import { uuidv7 } from "@metriport/shared/util/uuid-v7";

import { getDeaScheduleName } from "@metriport/shared/interface/external/surescripts/dea-schedule";
import { getNcpdpName } from "@metriport/shared/interface/external/surescripts/ncpdp";

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

export function getMedicationReference(medication: Medication): Reference<Medication> {
  return {
    reference: `Medication/${medication.id}`,
    display: medication.code?.text ?? "",
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
  const deaScheduleDisplay = getDeaScheduleName(detail.deaSchedule);

  return {
    system: "http://terminology.hl7.org/CodeSystem/v3-substanceAdminSubstitution",
    code: detail.deaSchedule,
    ...(deaScheduleDisplay ? { display: deaScheduleDisplay } : undefined),
  };
}

function getMedicationForm(detail: ResponseDetail): Coding | undefined {
  if (!detail.strengthFormCode) return undefined;
  const ncpdpName = getNcpdpName(detail.strengthFormCode);
  return {
    system: "http://snomed.info/sct",
    code: detail.strengthFormCode,
    ...(ncpdpName ? { display: ncpdpName } : undefined),
  };
}

function getMedicationAmount(detail: ResponseDetail): Ratio | undefined {
  if (!detail.quantityDispensed || !detail.quantityUnitOfMeasure) return undefined;
  const quantityUnitOfMeasureDisplay = getNcpdpName(detail.quantityUnitOfMeasure);

  return {
    numerator: {
      value: Number(detail.quantityDispensed),
      unit: detail.quantityUnitOfMeasure,
      ...(quantityUnitOfMeasureDisplay ? { display: quantityUnitOfMeasureDisplay } : undefined),
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
  };
}

function getMedicationIngredient(detail: ResponseDetail): MedicationIngredient[] | undefined {
  if (!detail.strengthValue || !detail.strengthFormCode || !detail.strengthUnitOfMeasure)
    return undefined;
  const strengthUnitOfMeasureDisplay = getNcpdpName(detail.strengthUnitOfMeasure);
  const strengthFormCodeDisplay = getNcpdpName(detail.strengthFormCode);

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
          ...(strengthUnitOfMeasureDisplay ? { display: strengthUnitOfMeasureDisplay } : undefined),
        },
        denominator: {
          value: 1,
          unit: detail.strengthFormCode,
          system: "http://unitsofmeasure.org",
          code: detail.strengthFormCode,
          ...(strengthFormCodeDisplay ? { display: strengthFormCodeDisplay } : undefined),
        },
      },
    },
  ];
}
