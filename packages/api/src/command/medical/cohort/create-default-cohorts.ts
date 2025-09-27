import { createCohort } from "./create-cohort";

const defaultCohortConfigs = [
  {
    name: "High Risk",
    description: "Patients that need frequent and robust monitoring.",
    color: "red" as const,
    settings: {
      // TODO
    },
  },
  {
    name: "Medium Risk",
    description: "Patients that need some monitoring.",
    color: "yellow" as const,
    settings: {
      // TODO
    },
  },
  {
    name: "Low Risk",
    description: "Patients that need minimal monitoring.",
    color: "green" as const,
    settings: {
      // TODO
    },
  },
];

/**
 * Creates the set of cohorts that an organization is initialized with. These
 * may have settings customized during onboarding, but are useful to early
 * bulk imports.
 *
 * @param cxId The cxId of the org to create these cohorts under
 */
export async function createDefaultCohorts({ cxId }: { cxId: string }) {
  await Promise.all(
    defaultCohortConfigs.map(async config => {
      await createCohort({
        cxId,
        ...config,
      });
    })
  );
}
