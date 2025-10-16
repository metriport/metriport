import { faker } from "@faker-js/faker";
import {
  CohortCreateInput,
  CohortDTO,
  cohortSettingsSchema,
} from "@metriport/shared/domain/cohort";

export const createCohort: CohortCreateInput = {
  name: faker.word.noun(),
};

export function validateCohort(cohort: CohortDTO) {
  expect(cohort.name).toBeTruthy();
  expect(cohort.description).toBeDefined();
  expect(cohort.settings).toBeTruthy();
  expect(() => cohortSettingsSchema.parse(cohort.settings)).not.toThrow();
}
