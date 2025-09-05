import { RxNormEntity } from "@aws-sdk/client-comprehendmedical";
import { Medication, MedicationStatement } from "@medplum/fhirtypes";
import { ComprehendClient } from "../client";
import { ComprehendConfig } from "../types";
import { buildMedication } from "./medication";
import { buildMedicationStatement } from "./medication-statement";
import { isMedicationEntity, isConfidentMatch } from "./shared";

export async function inferMedications(
  text: string,
  {
    comprehendClient = new ComprehendClient(),
    confidenceThreshold = 0.8,
  }: { comprehendClient?: ComprehendClient; confidenceThreshold?: number } = {}
): Promise<Array<Medication | MedicationStatement>> {
  const response = await comprehendClient.inferRxNorm(text);
  return getFhirResourcesFromRxNormEntities(response.Entities ?? [], { confidenceThreshold });
}

export function getFhirResourcesFromRxNormEntities(
  entities: RxNormEntity[],
  { confidenceThreshold }: ComprehendConfig
): Array<Medication | MedicationStatement> {
  const resources: Array<Medication | MedicationStatement> = [];

  for (const entity of entities) {
    if (isMedicationEntity(entity) && isConfidentMatch(entity, confidenceThreshold)) {
      const medication = buildMedication(entity);
      if (!medication) continue;

      const medicationStatement = buildMedicationStatement(medication, entity);
      if (medication && medicationStatement) {
        resources.push(medication, medicationStatement);
      }
    }
  }

  return resources;
}
