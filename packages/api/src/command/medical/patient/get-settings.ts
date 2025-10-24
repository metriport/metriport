import { DeepPartial, mergeSettings } from "@metriport/shared/common/merge-settings";
import { AllOptionalCohortSettings, CohortSettings } from "@metriport/shared/domain/cohort";

/**
 * Merges complete and uncomplete cohort settings into a single cohort settings object. Takes the old settings as the base and merges the new settings into it.
 * If a new setting is undefined, the old value is used. !!Otherwise, the new value is used!!
 * @param oldSettings Old cohort settings
 * @param newSettings New cohort settings
 * @returns Merged cohort settings
 */
export function mergeOldWithNewCohortSettings(
  oldSettings: CohortSettings,
  newSettings: AllOptionalCohortSettings
) {
  return mergeSettings(oldSettings, newSettings as DeepPartial<CohortSettings>);
}
