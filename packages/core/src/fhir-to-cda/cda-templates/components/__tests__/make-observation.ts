import { Observation } from "@medplum/fhirtypes";
import { makeBaseDomain, makeSubjectReference } from "./shared";

export function makeObservation(params: Partial<Observation> = {}): Observation {
  return {
    ...makeBaseDomain(),
    ...makeSubjectReference(),
    resourceType: "Observation",
    ...params,
  };
}
