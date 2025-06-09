import { faker } from "@faker-js/faker";

export function makeMedicationReference(id?: string | undefined) {
  return `Medication/${id ?? faker.string.uuid()}`;
}
