import { faker } from "@faker-js/faker";
import { Condition } from "@medplum/fhirtypes";
import { makeBaseDomain, makeSubjectReference } from "./shared";

// TODO move this to external/fhir/__tests__/condition.ts
export function makeCondition(params: Partial<Condition> = {}, patientId?: string): Condition {
  return {
    ...makeBaseDomain(),
    ...makeSubjectReference(patientId),
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
    ...(params.encounter?.id
      ? {
          encounter: {
            reference: `Encounter/${params.encounter.id}`,
          },
        }
      : {}),
    ...params,
  };
}
