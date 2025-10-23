import { RxNormAttributeType, RxNormEntity } from "@aws-sdk/client-comprehendmedical";
import { CodeableConcept, MedicationIngredient, Ratio } from "@medplum/fhirtypes";
import { getAttribute } from "../shared";
import { parseRatio } from "../../../fhir/parser/ratio";

export function buildStrength(
  medicationCode: CodeableConcept,
  entity: RxNormEntity
): MedicationIngredient | undefined {
  const strength = buildStrengthRatio(entity);
  if (!strength) return undefined;

  return {
    itemCodeableConcept: medicationCode,
    isActive: true,
    strength,
  };
}

export function buildStrengthRatio(entity: RxNormEntity): Ratio | undefined {
  const strength = getAttribute(entity, RxNormAttributeType.STRENGTH);
  if (!strength) return undefined;

  if (!strength.Text) return undefined;
  return parseRatio(strength.Text);
}
