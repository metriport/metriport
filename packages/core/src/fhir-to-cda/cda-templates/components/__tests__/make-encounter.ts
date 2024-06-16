import { Encounter, Practitioner, Location } from "@medplum/fhirtypes";
import { makeBaseDomain, makeSubjectReference } from "./shared";

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
  ids: { enc: string; pract: string; loc: string }
): Encounter {
  return {
    ...makeBaseDomain(),
    ...makeSubjectReference(),
    id: ids.enc,
    resourceType: "Encounter",
    ...params,
    participant: [{ individual: { reference: `Practitioner/${ids.pract}` } }],
    location: [{ location: { reference: `Location/${ids.loc}` } }],
  };
}
