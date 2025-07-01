import { Entity, RxNormEntityCategory } from "@aws-sdk/client-comprehendmedical";
import { MedicationStatement } from "@medplum/fhirtypes";

export function buildMedicationStatement(entity: Entity): MedicationStatement | undefined {
  if (entity.Category !== RxNormEntityCategory.MEDICATION) {
    return undefined;
  }

  const medicationStatement: MedicationStatement = {
    resourceType: "MedicationStatement",
  };

  return medicationStatement;
}
