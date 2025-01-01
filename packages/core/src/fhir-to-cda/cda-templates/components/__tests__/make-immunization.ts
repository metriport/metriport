import { faker } from "@faker-js/faker";
import { Immunization } from "@medplum/fhirtypes";
import { makeBaseDomain, makeSubjectReference } from "./shared";

export function makeImmunization(
  params: Partial<Immunization> = {},
  ids?: { imm?: string; loc?: string }
): Immunization {
  return {
    ...makeBaseDomain(),
    ...makeSubjectReference(),
    resourceType: "Immunization",
    id: ids?.imm ?? faker.string.uuid(),
    location: { reference: `Location/${ids?.loc ?? faker.string.uuid()}` },
    ...params,
  };
}
