import { faker } from "@faker-js/faker";
import { Organization } from "@medplum/fhirtypes";
import { makeSubjectReference } from "./shared";

export function makeOrganization(
  params: Partial<Organization> = {},
  patientId?: string
): Organization {
  return {
    ...(params.id ? { id: params.id } : { id: faker.string.uuid() }),
    ...makeSubjectReference(patientId),
    resourceType: "Organization",
    ...params,
  };
}
