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
  externalContext: ComprehendContext,
  {
    comprehendClient = new ComprehendClient(),
    confidenceThreshold = 0.1,
  }: { comprehendClient?: ComprehendClient; confidenceThreshold?: number } = {}
): Promise<Array<Medication | MedicationStatement>> {
  const response = await comprehendClient.inferRxNorm(text);
  const context: ComprehendContext = {
    ...externalContext,
    originalText: text,
  };

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
    // A Medication is required in order to build a MedicationStatement
    if (isMedicationEntity(entity) && isConfidentMatch(entity, confidenceThreshold)) {
      const medication = buildMedication(entity, context);
      if (!medication) continue;

      const medicationStatement = buildMedicationStatement({ medication, entity, context });
      resources.push(medication, medicationStatement);
    }
  }

  return _(resources).compact().value();
}
