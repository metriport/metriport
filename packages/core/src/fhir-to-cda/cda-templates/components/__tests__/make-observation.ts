import { faker } from "@faker-js/faker";
import { Observation } from "@medplum/fhirtypes";
import { makeBaseDomain, makeSubjectReference } from "./shared";

export function makeObservation(
  params: Partial<Observation> = {},
  patientId?: string | undefined
): Observation {
  return {
    ...makeBaseDomain(),
    ...makeSubjectReference(patientId),
    resourceType: "Observation",
    id: params.id ?? faker.string.uuid(),
    ...params,
  };
}
