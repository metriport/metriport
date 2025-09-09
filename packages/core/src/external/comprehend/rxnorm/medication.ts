import { RxNormEntity } from "@aws-sdk/client-comprehendmedical";
import { Medication, CodeableConcept, Reference } from "@medplum/fhirtypes";
import { getRxNormCode } from "./shared";
import { uuidv7 } from "@metriport/shared/util/uuid-v7";
import { RXNORM_URL } from "@metriport/shared/medical";
import { buildStrength, buildStrengthRatio } from "./attribute/strength";

export function buildMedication(entity: RxNormEntity): Medication | undefined {
  const code = buildMedicationCode(entity);
  if (!code) return undefined;

  const amount = buildStrengthRatio(entity);
  const ingredient = buildStrength(code, entity);

  return {
    resourceType: "Medication",
    id: uuidv7(),
    status: "active",
    ...(amount ? { amount } : undefined),
    ...(ingredient ? { ingredient: [ingredient] } : undefined),
    code,
  };
}

export function getMedicationReference(medication: Medication): Reference<Medication> | undefined {
  return {
    reference: `Medication/${medication.id}`,
  };
}

function buildMedicationCode(entity: RxNormEntity): CodeableConcept | undefined {
  const code = getRxNormCode(entity);
  if (!code) return undefined;

  const display = entity.Text;
  if (!display) return undefined;

  return {
    coding: [{ system: RXNORM_URL, code, display }],
  };
}
