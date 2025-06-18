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
import { DEA_SCHEDULE_URL, UNIT_OF_MEASURE_URL } from "./constants";
import { NDC_URL, SNOMED_URL } from "../../../util/constants";
import { getSurescriptsDataSourceExtension } from "./shared";

export function getMedication(detail: ResponseDetail): Medication {
  const code = getMedicationCodeableConcept(detail);
  const ingredient = getMedicationIngredient(detail);
  const form = getMedicationForm(detail);
  const amount = getMedicationAmount(detail);
  const batch = getMedicationBatch(detail);
  const extension = [getSurescriptsDataSourceExtension()];

  return {
    resourceType: "Medication",
    id: uuidv7(),
    status: "active",
    ...(code ? { code } : undefined),
    ...(ingredient && ingredient.length > 0 ? { ingredient } : undefined),
    ...(form ? { form } : undefined),
    ...(amount ? { amount } : undefined),
    ...(batch ? { batch } : undefined),
    extension,
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

function getMedicationCoding(detail: ResponseDetail): Coding[] | undefined {
  if (!detail.ndcNumber && !detail.productCode && !detail.deaSchedule) return undefined;

  const ndcCode = getMedicationNdcCode(detail);
  const productCode = getMedicationProductCode(detail);
  const deaCode = getMedicationDeaScheduleCode(detail);
  const coding = [ndcCode, productCode, deaCode].filter(Boolean) as Coding[];

  return coding;
}

export function getMedicationReference(medication: Medication): Reference<Medication> {
  return {
    reference: `Medication/${medication.id}`,
  };
}

function getMedicationText(detail: ResponseDetail): string | undefined {
  if (!detail.drugDescription) return undefined;
  return detail.drugDescription;
}

function getMedicationNdcCode(detail: ResponseDetail): Coding | undefined {
  if (!detail.ndcNumber) return undefined;
  return {
    system: NDC_URL,
    code: detail.ndcNumber,
    ...(detail.drugDescription ? { display: detail.drugDescription } : undefined),
  };
}

function getMedicationProductCode(detail: ResponseDetail): Coding | undefined {
  if (!detail.productCode) return undefined;
  return {
    system: NDC_URL,
    code: detail.productCode,
    ...(detail.drugDescription ? { display: detail.drugDescription } : undefined),
  };
}

function getMedicationDeaScheduleCode(detail: ResponseDetail): Coding | undefined {
  if (!detail.deaSchedule) return undefined;
  const deaScheduleDisplay = getDeaScheduleName(detail.deaSchedule);

  return {
    system: DEA_SCHEDULE_URL,
    code: detail.deaSchedule,
    ...(deaScheduleDisplay ? { display: deaScheduleDisplay } : undefined),
  };
}

function getMedicationForm(detail: ResponseDetail): CodeableConcept | undefined {
  if (!detail.strengthFormCode) return undefined;
  const ncpdpName = getNcpdpName(detail.strengthFormCode);
  return {
    coding: [
      {
        system: SNOMED_URL,
        code: detail.strengthFormCode,
        ...(ncpdpName ? { display: ncpdpName } : undefined),
      },
    ],
  };
}

function getMedicationAmount(detail: ResponseDetail): Ratio | undefined {
  if (!detail.quantityDispensed || !detail.quantityUnitOfMeasure) {
    return undefined;
  }
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
  if (!detail.strengthValue || !detail.strengthFormCode || !detail.strengthUnitOfMeasure) {
    return undefined;
  }
  const strengthUnitOfMeasureDisplay = getNcpdpName(detail.strengthUnitOfMeasure);
  const strengthFormCodeDisplay = getNcpdpName(detail.strengthFormCode);
  const itemCodeableConcept = getMedicationIngredientCodeableConcept(detail);

  return [
    {
      ...(itemCodeableConcept ? { itemCodeableConcept } : undefined),
      strength: {
        numerator: {
          value: Number(detail.strengthValue),
          system: UNIT_OF_MEASURE_URL,
          code: detail.strengthUnitOfMeasure,
          ...(strengthUnitOfMeasureDisplay ? { display: strengthUnitOfMeasureDisplay } : undefined),
        },
        denominator: {
          value: 1,
          unit: detail.strengthFormCode,
          system: UNIT_OF_MEASURE_URL,
          code: detail.strengthFormCode,
          ...(strengthFormCodeDisplay ? { display: strengthFormCodeDisplay } : undefined),
        },
      },
    },
  ];
}

function getMedicationIngredientCodeableConcept(
  detail: ResponseDetail
): CodeableConcept | undefined {
  if (!detail.drugDatabaseCode || !detail.drugDescription) return undefined;
  return {
    coding: [
      {
        system: SNOMED_URL,
        code: detail.drugDatabaseCode,
        ...(detail.drugDescription ? { display: detail.drugDescription } : undefined),
      },
    ],
  };
}
