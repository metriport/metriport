import { faker } from "@faker-js/faker";
import {
  CohortCreateInput,
  cohortSettingsSchema,
  CohortWithSizeDTO,
} from "@metriport/shared/domain/cohort";

export const createCohort: CohortCreateInput = {
  name: faker.word.noun(),
};

export function validateCohort(cohort: CohortWithSizeDTO) {
  expect(cohort.name).toBeTruthy();
  expect(cohort.description).toBeDefined();
  expect(cohort.settings).toBeTruthy();
  expect(cohort.size).toBeDefined();
  expect(() => cohortSettingsSchema.parse(cohort.settings)).not.toThrow();
}
