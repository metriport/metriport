import { UniqueConstraintError } from "sequelize";
import { createCohort } from "./create-cohort";

const defaultCohortConfigs = [
  {
    name: "High Risk",
    description: "Patients that need frequent and robust monitoring.",
    color: "red",
    settings: {
      // TODO
    },
  },
  {
    name: "Medium Risk",
    description: "Patients that need some monitoring.",
    color: "yellow",
    settings: {
      // TODO
    },
  },
  {
    name: "Low Risk",
    description: "Patients that need minimal monitoring.",
    color: "green",
    settings: {
      // TODO
    },
  },
] as const;

/**
 * Creates the set of cohorts that an organization is initialized with. These
 * may have settings customized during onboarding, but are useful to early
 * bulk imports. This is idempotent, skipping already created cohorts.
 *
 * @param cxId The cxId of the org to create these cohorts under
 */
export async function createDefaultCohorts({ cxId }: { cxId: string }) {
  await Promise.all(
    defaultCohortConfigs.map(async config => {
      try {
        await createCohort({ cxId, ...config });
      } catch (err) {
        if (err instanceof UniqueConstraintError) {
          console.log("Default cohort already created. Skipping...");
          return;
        }
        throw err;
      }
    })
  );
}
