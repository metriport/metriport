import { faker } from "@faker-js/faker";
import { MedicationDispense } from "@medplum/fhirtypes";
import { makeMedicationReference } from "./medication-reference";

export function makeMedicationDispense(params?: Partial<MedicationDispense>): MedicationDispense {
  const medicationReference = params?.medicationReference ?? {
    reference: makeMedicationReference(),
  };
  return {
    resourceType: "MedicationDispense",
    ...(params?.id ? { id: params.id } : { id: faker.string.uuid() }),
    extension: [
      {
        url: "https://public.metriport.com/fhir/StructureDefinition/doc-id-extension.json",
        valueString: `${faker.string.uuid()}.xml`,
      },
    ],
    status: "completed",
    medicationReference,
    ...params,
  };
}
