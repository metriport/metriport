import { faker } from "@faker-js/faker";
import {
  COHORT_COLORS,
  CohortCreateRequest,
  cohortSettingsSchema,
} from "@metriport/shared/domain/cohort";
import { CohortDTO } from "@metriport/shared/domain/cohort";

export const createCohort: CohortCreateRequest = {
  name: faker.word.noun(),
  description: faker.lorem.sentence(),
  color: faker.helpers.arrayElement(COHORT_COLORS),
  settings: {
    adtMonitoring: true,
  },
};

export function validateCohort(cohort: CohortDTO) {
  expect(cohort.name).toBeTruthy();
  expect(cohort.color).toBeTruthy();
  expect(cohort.description).toBeTruthy();
  expect(cohort.settings).toBeTruthy();
  expect(() => cohortSettingsSchema.parse(cohort.settings)).not.toThrow();
}
