import {
  RxNormAttributeType,
  RxNormAttribute,
  RxNormEntity,
  RxNormEntityCategory,
} from "@aws-sdk/client-comprehendmedical";
import { uuidv7 } from "@metriport/shared/util/uuid-v7";
import { Medication, MedicationStatement } from "@medplum/fhirtypes";
import { ComprehendConfig } from "../types";
import { isConfidentMatch } from "./shared";

export function buildMedicationResources(
  entities: RxNormEntity[],
  { confidenceThreshold }: ComprehendConfig
): Array<Medication | MedicationStatement> {
  const resources: Array<Medication | MedicationStatement> = [];

  for (const entity of entities) {
    if (isMedicationEntity(entity) && isConfidentMatch(entity, confidenceThreshold)) {
      // const medicationRxNorm = getRxNormCode(entity);
      const medication = buildMedication(entity);
      if (medication) resources.push(medication);
      else continue;

      const medicationStatement = buildMedicationStatement(medication, entity);
      if (medicationStatement) resources.push(medicationStatement);
    }
  }

  return resources;
}

function buildMedication(entity: RxNormEntity): Medication | undefined {
  const rxNormCode = getRxNormCode(entity);
  if (!rxNormCode) return undefined;

  const medication: Medication = {
    resourceType: "Medication",
    id: uuidv7(),
    code: {
      coding: [
        {
          system: "http://www.nlm.nih.gov/research/umls/rxnorm",
          code: rxNormCode,
          display: entity.Text ?? "",
        },
      ],
    },
    status: "active",
  };

  return medication;
}

export function buildMedicationStatement(
  medication: Medication,
  entity: RxNormEntity
): MedicationStatement | undefined {
  const effectivePeriod = buildEffectivePeriod(entity);
  const dosage = buildDosage(entity);

  return {
    resourceType: "MedicationStatement",
    id: uuidv7(),
    status: "active",
    medicationReference: {
      reference: `Medication/${medication.id}`,
    },
    ...(dosage ? { dosage } : undefined),
    ...(effectivePeriod ? { effectivePeriod } : undefined),
  };
}

function getAttribute(
  entity: RxNormEntity,
  type: RxNormAttributeType
): RxNormAttribute | undefined {
  return entity.Attributes?.find(attribute => attribute.Type === type);
}

function buildEffectivePeriod(
  entity: RxNormEntity
): MedicationStatement["effectivePeriod"] | undefined {
  const duration = getAttribute(entity, RxNormAttributeType.DURATION);
  const durationValue = duration?.Text;
  if (!durationValue) return undefined;
  // TODO: parse durationValue into a Period
  return undefined;
}

function buildDosage(entity: RxNormEntity): MedicationStatement["dosage"] | undefined {
  // -> dosage.text or dosage.doseAndRate.doseQuantity
  const dosage = getAttribute(entity, RxNormAttributeType.DOSAGE);
  const frequency = getAttribute(entity, RxNormAttributeType.FREQUENCY);
  const rate = getAttribute(entity, RxNormAttributeType.RATE);

  if (!frequency && !rate) return undefined;

  return [
    {
      text: dosage?.Text ?? "",
      doseAndRate: [
        {
          rateQuantity: {
            value: 1,
            unit: "mg",
          },
        },
      ],
      timing: {
        repeat: {
          frequency: 2,
          period: 1,
          periodUnit: "d",
        },
      },
    },
  ];
}

function getRxNormCode(entity: RxNormEntity): string | undefined {
  return entity.RxNormConcepts?.[0]?.Code;
}

// readonly DOSAGE: "DOSAGE";
//     readonly DURATION: "DURATION";
//     readonly FORM: "FORM";
//     readonly FREQUENCY: "FREQUENCY";
//     readonly RATE: "RATE";
//     readonly ROUTE_OR_MODE: "ROUTE_OR_MODE";
//     readonly STRENGTH: "STRENGTH";

function isMedicationEntity(entity: RxNormEntity): boolean {
  return entity.Category === RxNormEntityCategory.MEDICATION;
}
