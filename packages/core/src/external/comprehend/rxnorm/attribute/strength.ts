import { RxNormAttributeType, RxNormEntity } from "@aws-sdk/client-comprehendmedical";
import { CodeableConcept, MedicationIngredient } from "@medplum/fhirtypes";
import { getAttribute } from "../shared";
import { parseRatio } from "../../../fhir/parser/ratio";

export function buildStrength(
  medicationCode: CodeableConcept,
  entity: RxNormEntity
): MedicationIngredient | undefined {
  const strength = getAttribute(entity, RxNormAttributeType.STRENGTH);
  if (!strength) return undefined;

  if (!strength.Text) return undefined;
  const ratio = parseRatio(strength.Text);
  if (!ratio) return undefined;

  return {
    itemCodeableConcept: medicationCode,
    isActive: true,
    strength: ratio,
  };
}
