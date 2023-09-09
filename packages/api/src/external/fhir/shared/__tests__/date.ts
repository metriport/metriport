import { faker } from "@faker-js/faker";
import { Period } from "@medplum/fhirtypes";

export const makePeriod = (param: Partial<Period> = {}): Period => {
  const end = faker.date.past();
  const start = faker.date.past({ refDate: end });
  return {
    start: param.start ?? start.toISOString(),
    end: param.end ?? end.toISOString(),
  };
};
