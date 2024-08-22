import { faker } from "@faker-js/faker";
import { Procedure } from "@medplum/fhirtypes";

export function makeProcedure(params: Partial<Procedure> = {}): Procedure {
  return {
    ...(params.id ? { id: params.id } : { id: faker.string.uuid() }),
    resourceType: "Procedure",
    code: params.code ?? {
      coding: [
        {
          system: "http://www.ama-assn.org/go/cpt",
          code: "87389",
        },
      ],
    },
    ...params,
  };
}
