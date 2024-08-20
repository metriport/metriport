import { faker } from "@faker-js/faker";
import { Condition } from "@medplum/fhirtypes";
import { makeBaseDomain, makeSubjectReference } from "./shared";

export function makeCondition(params: Partial<Condition> = {}): Condition {
  return {
    ...makeBaseDomain(),
    ...makeSubjectReference(),
    resourceType: "Condition",
    ...(params.id ? { id: params.id } : { id: faker.string.uuid() }),
    code: params.code ?? {
      coding: [
        {
          system: "2.16.840.1.113883.6.90",
          code: "F17.200",
          display: "NICOTINE DEPENDENCE, UNSP, UNCOMPLI",
        },
      ],
      text: "NICOTINE DEPENDENCE, UNSP, UNCOMPLI",
    },
    ...params,
  };
}
