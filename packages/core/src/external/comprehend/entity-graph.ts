import { Entity, RxNormEntityCategory } from "@aws-sdk/client-comprehendmedical";
import { Medication, MedicationRequest, MedicationStatement } from "@medplum/fhirtypes";
import { buildMedicationStatement } from "./fhir/medication-statement";
import { EntityGraph, MedicationEntityGraph } from "./types";

export function buildEntityGraph(entities: Entity[]): EntityGraph {
  const medicationEntityGraph = buildMedicationEntityGraph(entities);

  return {
    entities,
    ...medicationEntityGraph,
  };
}

// export function mergeEntityGraphs(entityGraphs: EntityGraph[]): EntityGraph {
//   return {
//     entities: mergeEntityGraphArray(entityGraphs, "entities"),
//     medications: mergeEntityGraphArray(entityGraphs, "medications"),
//     medicationRequests: mergeEntityGraphArray(entityGraphs, "medicationRequests"),
//     medicationStatements: mergeEntityGraphArray(entityGraphs, "medicationStatements"),
//   }
// }

export function buildMedicationEntityGraph(entities: Entity[]): MedicationEntityGraph {
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
    medications,
    medicationRequests,
    medicationStatements,
  };
}

function getRxNormEntities(entities: Entity[]): Entity[] {
  return entities.filter(entity => entity.Category === RxNormEntityCategory.MEDICATION);
}
