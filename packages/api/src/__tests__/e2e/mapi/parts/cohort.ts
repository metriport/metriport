import { faker } from "@faker-js/faker";
import { Cohort, CohortCreate, COHORT_COLORS } from "@metriport/shared/domain/cohort";
import { cohortSettingsSchema } from "@metriport/shared/src/domain/cohort";

export const createCohort: CohortCreate = {
  name: faker.word.noun(),
  description: faker.lorem.sentence(),
  color: faker.helpers.arrayElement(COHORT_COLORS),
  settings: {
    adtMonitoring: true,
  },
};

export function validateCohort(cohort: Cohort) {
  expect(cohort.id).toBeTruthy();
  expect(cohort.color).toBeTruthy();
  expect(cohort.description).toBeTruthy();
  expect(cohort.settings).toBeTruthy();
  expect(() => cohortSettingsSchema.parse(cohort.settings)).not.toThrow();
}
