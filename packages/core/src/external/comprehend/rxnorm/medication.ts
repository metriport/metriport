import { RxNormEntity } from "@aws-sdk/client-comprehendmedical";
import { Medication, CodeableConcept, Reference } from "@medplum/fhirtypes";
import { uuidv7 } from "@metriport/shared/util/uuid-v7";
import { RXNORM_URL } from "@metriport/shared/medical";
import { getRxNormCode } from "./shared";
import { ComprehendContext } from "../types";
import { buildStrengthRatio } from "./attribute/strength";
import { buildForm } from "./attribute/form";
import { buildComprehendExtensionForEntity } from "../extension";

export function buildMedication(
  entity: RxNormEntity,
  context: ComprehendContext
): Medication | undefined {
  const code = buildMedicationCode(entity);
  if (!code) return undefined;

  const amount = buildStrengthRatio(entity);
  const form = buildForm(entity);
  const extension = [buildComprehendExtensionForEntity(entity, context)];

  return {
    resourceType: "Medication",
    id: uuidv7(),
    status: "active",
    code,
    ...(form ? { form } : undefined),
    ...(amount ? { amount } : undefined),
    extension,
  };
}

export function getMedicationReference(medication: Medication): Reference<Medication> {
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
