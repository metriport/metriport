import { Entity, RxNormEntityCategory } from "@aws-sdk/client-comprehendmedical";
import { Medication, MedicationRequest, MedicationStatement } from "@medplum/fhirtypes";
import { buildMedicationStatement } from "./fhir/medication-statement";
import { EntityGraph } from "./types";

export function buildEntityGraph(entities: Entity[]): EntityGraph {
  const rxNormEntities = getRxNormEntities(entities);

  const medications: Medication[] = [];
  const medicationRequests: MedicationRequest[] = [];
  const medicationStatements: MedicationStatement[] = [];

  for (const rxNormEntity of rxNormEntities) {
    const medicationStatement = buildMedicationStatement(rxNormEntity);
    if (medicationStatement) {
      medicationStatements.push(medicationStatement);
    }
  }

  return {
    entities,
    medications,
    medicationRequests,
    medicationStatements,
  };
}

function getRxNormEntities(entities: Entity[]): Entity[] {
  return entities.filter(entity => entity.Category === RxNormEntityCategory.MEDICATION);
}
