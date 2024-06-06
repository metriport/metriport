import { Immunization } from "@medplum/fhirtypes";
import { makeBaseDomain, makeSubjectReference } from "./shared";

export function makeImmunization(
  params: Partial<Immunization> = {},
  ids: { imm: string; loc: string }
): Immunization {
  return {
    ...makeBaseDomain(),
    ...makeSubjectReference(),
    resourceType: "Immunization",
    ...params,
    id: ids.imm,
    location: { reference: `Location/${ids.loc}` },
  };
}
