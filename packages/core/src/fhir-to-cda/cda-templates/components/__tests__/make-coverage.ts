import { faker } from "@faker-js/faker";
import { Coverage } from "@medplum/fhirtypes";

export function makeCoverage(params?: Partial<Coverage>, payorRef?: string): Coverage {
  return {
    resourceType: "Coverage",
    payor: [
      {
        reference: `Organization/${payorRef ?? faker.string.uuid()}`,
      },
    ],
    ...params,
  };
}
