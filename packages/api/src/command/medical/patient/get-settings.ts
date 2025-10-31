import {
  getExcludeHieNameString,
  getHieNames,
} from "@metriport/core/external/hl7-notification/hie-config-dictionary";
import { BadRequestError } from "@metriport/shared";
import { DeepPartial, mergeSettings } from "@metriport/shared/common/merge-settings";
import {
  AllOptionalFullCohortSettings,
  CohortSettings,
  FullCohortSettings,
} from "@metriport/shared/domain/cohort";

/**
 * Merges complete and uncomplete cohort settings into a single cohort settings object. Takes the old settings as the base and merges the new settings into it.
 * If a new setting is undefined, the old value is used. !!Otherwise, the new value is used!!
 * @param oldSettings Old cohort settings
 * @param newSettings New cohort settings
 * @returns Merged cohort settings
 */
export function mergeOldWithNewCohortSettings(
  oldSettings: FullCohortSettings,
  newSettings: AllOptionalFullCohortSettings
): FullCohortSettings {
  return mergeSettings(oldSettings, newSettings as DeepPartial<FullCohortSettings>);
}

/**
 * Applies default overrides to settings for all HIE names.
 * Creates default overrides with all Exclude_<HieName> keys set to false,
 * then merges any existing overrides from settings on top.
 *
 * @param settings - A settings object that already contains everything except full overrides.
 * @returns Settings object with default overrides applied
 * @throws BadRequestError if any override keys don't match the "Exclude_<hieName>" format
 */
export function applyCohortOverrides(
  settings: CohortSettings & {
    overrides?: Record<string, boolean>;
  }
): FullCohortSettings {
  const hieNames = getHieNames();
  const defaultOverrides: Record<string, boolean> = {};
  hieNames.forEach(hieName => {
    defaultOverrides[getExcludeHieNameString(hieName)] = false;
  });

  const validOverrideKeys = new Set(Object.keys(defaultOverrides));
  const overridesSent = settings?.overrides;
  if (overridesSent) {
    for (const key of Object.keys(overridesSent)) {
      if (!validOverrideKeys.has(key)) {
        throw new BadRequestError(`Invalid override key: ${key}`, undefined, {
          invalidOverride: key,
          validOverrides: Array.from(validOverrideKeys).join(", "),
        });
      }
    }
  }

  const mergedSettings = mergeOldWithNewCohortSettings(settings, {
    ...settings,
    overrides: overridesSent ?? defaultOverrides,
  });

  return mergedSettings;
}
