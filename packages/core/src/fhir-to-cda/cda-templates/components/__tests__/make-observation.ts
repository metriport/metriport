import { faker } from "@faker-js/faker";
import { Observation } from "@medplum/fhirtypes";
import { makeBaseDomain, makeSubjectReference } from "./shared";

export function makeObservation(params: Partial<Observation> = {}): Observation {
  return {
    ...makeBaseDomain(),
    ...makeSubjectReference(),
    resourceType: "Observation",
    id: params.id ?? faker.string.uuid(),
    ...params,
  };
}
