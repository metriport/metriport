import { faker } from "@faker-js/faker";
import {
  CohortCreateInput,
  CohortWithSizeDTO,
  fullCohortSettingsSchema,
} from "@metriport/shared/domain/cohort";

export const createCohort: CohortCreateInput = {
  name: faker.word.noun(),
};

export function validateCohort(cohort: CohortWithSizeDTO) {
  expect(cohort.name).toBeTruthy();
  expect(cohort.description).toBeDefined();
  expect(cohort.settings).toBeTruthy();
  expect(cohort.size).toBeDefined();
  expect(cohort.color).toBeDefined();
  expect(() => fullCohortSettingsSchema.parse(cohort.settings)).not.toThrow();
}
