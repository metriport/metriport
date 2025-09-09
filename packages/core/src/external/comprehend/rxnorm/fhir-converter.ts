import _ from "lodash";
import { RxNormEntity } from "@aws-sdk/client-comprehendmedical";
import { Medication, MedicationStatement } from "@medplum/fhirtypes";
import { ComprehendClient } from "../client";
import { ComprehendContext } from "../types";
import { buildMedication } from "./medication";
import { buildMedicationStatement } from "./medication-statement";
import { isMedicationEntity, isConfidentMatch } from "./shared";

export async function inferMedications(
  text: string,
  context: ComprehendContext,
  {
    comprehendClient = new ComprehendClient(),
    confidenceThreshold = 0.8,
  }: { comprehendClient?: ComprehendClient; confidenceThreshold?: number }
): Promise<Array<Medication | MedicationStatement>> {
  const response = await comprehendClient.inferRxNorm(text);
  return getFhirResourcesFromRxNormEntities(response.Entities ?? [], {
    confidenceThreshold,
    context,
  });
}

export function getFhirResourcesFromRxNormEntities(
  entities: RxNormEntity[],
  { confidenceThreshold, context }: { confidenceThreshold: number; context: ComprehendContext }
): Array<Medication | MedicationStatement> {
  const resources: Array<Medication | MedicationStatement | undefined> = [];

  for (const entity of entities) {
    if (isMedicationEntity(entity) && isConfidentMatch(entity, confidenceThreshold)) {
      // A Medication is required for building a MedicationStatement
      const medication = buildMedication(entity);
      if (!medication) continue;

      const medicationStatement = buildMedicationStatement({ medication, entity, context });
      resources.push(medication, medicationStatement);
    }
  }

  return _(resources).compact().value();
}
