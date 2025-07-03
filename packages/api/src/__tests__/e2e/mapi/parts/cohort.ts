import { faker } from "@faker-js/faker";
import { Cohort, CohortCreate } from "@metriport/api-sdk";

export const createCohort: CohortCreate = {
  name: faker.word.noun(),
  monitoring: {
    adt: true,
  },
};

export function validateCohort(cohort: Cohort): void {
  expect(cohort.id).toBeTruthy();
  expect(cohort.monitoring).toBeTruthy();
  expect(cohort.monitoring.adt).not.toBeNull();
}
