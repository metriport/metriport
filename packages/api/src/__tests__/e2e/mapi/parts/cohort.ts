import { CohortWithSizeResponseWithoutOverrides } from "@metriport/shared/domain/cohort";
import { settingsSchema } from "../../../../routes/medical/schemas/cohort";

export function validateCohort(cohort: CohortWithSizeResponseWithoutOverrides) {
  expect(cohort.name).toBeTruthy();
  expect(cohort.description).toBeDefined();
  expect(cohort.settings).toBeTruthy();
  expect(cohort.size).toBeDefined();
  expect(cohort.color).toBeDefined();
  expect(() => settingsSchema.parse(cohort.settings)).not.toThrow();
}
