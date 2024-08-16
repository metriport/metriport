import { faker } from "@faker-js/faker";
import { Encounter, Location, Practitioner } from "@medplum/fhirtypes";
import { makeSubjectReference } from "./shared";

export function makePractitioner(params: Partial<Practitioner>): Practitioner {
  return {
    resourceType: "Practitioner",
    ...params,
  };
}

export function makeLocation(params: Partial<Location>): Location {
  return {
    resourceType: "Location",
    ...params,
  };
}

export function makeEncounter(
  params: Partial<Encounter> = {},
  ids?: { enc?: string; pract?: string; loc?: string }
): Encounter {
  return {
    ...makeSubjectReference(),
    id: ids?.enc ?? faker.string.uuid(),
    resourceType: "Encounter",
    participant: [
      { individual: { reference: `Practitioner/${ids?.pract ?? faker.string.uuid()}` } },
    ],
    location: [{ location: { reference: `Location/${ids?.loc ?? faker.string.uuid()}` } }],
    ...params,
  };
}
