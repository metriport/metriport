import { AllergyIntolerance } from "@medplum/fhirtypes";
import { makeBaseDomain, makeSubjectReference } from "./shared";

export function makeAllergy(params: Partial<AllergyIntolerance> = {}): AllergyIntolerance {
  return {
    ...makeBaseDomain(),
    ...makeSubjectReference(),
    resourceType: "AllergyIntolerance",
    ...params,
  };
}
