import { faker } from "@faker-js/faker";
import { Organization } from "@medplum/fhirtypes";
import { makeSubjectReference } from "./shared";

export function makeOrganization(params: Partial<Organization> = {}): Organization {
  return {
    ...(params.id ? { id: params.id } : { id: faker.string.uuid() }),
    ...makeSubjectReference(),
    resourceType: "Organization",
    ...params,
  };
}
