import { RxNormEntity } from "@aws-sdk/client-comprehendmedical";
import { Medication, CodeableConcept, Reference } from "@medplum/fhirtypes";
import { getRxNormCode } from "./shared";
import { uuidv7 } from "@metriport/shared/util/uuid-v7";
import { RXNORM_URL } from "@metriport/shared/medical";
import { buildStrength, buildStrengthRatio } from "./attribute/strength";
import { buildForm } from "./attribute/form";

export function buildMedication(entity: RxNormEntity): Medication | undefined {
  const code = buildMedicationCode(entity);
  if (!code) return undefined;

  const amount = buildStrengthRatio(entity);
  const ingredient = buildStrength(code, entity);
  const form = buildForm(entity);

  return {
    resourceType: "Medication",
    id: uuidv7(),
    status: "active",
    code,
    ...(form ? { form } : undefined),
    ...(amount ? { amount } : undefined),
    ...(ingredient ? { ingredient: [ingredient] } : undefined),
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
    text: display,
    coding: [{ system: RXNORM_URL, code, display }],
  };
}
