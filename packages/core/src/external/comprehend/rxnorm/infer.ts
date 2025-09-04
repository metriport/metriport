import { Medication, MedicationStatement } from "@medplum/fhirtypes";
import { ComprehendClient } from "../client";
import { getFhirResourcesFromRxNormEntities } from "./entity-to-fhir";

export async function inferMedications(
  text: string,
  { confidenceThreshold = 0.8 }: { confidenceThreshold?: number } = {}
): Promise<Array<Medication | MedicationStatement>> {
  const comprehendClient = new ComprehendClient();
  const response = await comprehendClient.inferRxNorm(text);
  return getFhirResourcesFromRxNormEntities(response.Entities ?? [], { confidenceThreshold });
}
