import {
  isAdtsRosterUploadFeatureFlagEnabledForCx,
  isQuestFeatureFlagEnabledForCx,
  isSurescriptsFeatureFlagEnabledForCx,
  isSurescriptsNotificationsFeatureFlagEnabledForCx,
} from "@metriport/core/command/feature-flags/domain-ffs";
import {
  getExcludeHieNameString,
  getHieNames,
} from "@metriport/core/external/hl7-notification/hie-config-dictionary";
import { BadRequestError } from "@metriport/shared";
import {
  AllOptionalSettings,
  AllOptionalMonitoringSettings,
  Overrides,
  STATE_VALIDATION_OVERRIDE_KEY,
} from "@metriport/shared/domain/cohort";

/**
 * Validates the cohort settings for the given CX.
 * @param cxId - The ID of the CX
 * @param settings - The cohort settings to validate. Undefined is valid.
 * @param log - The log function to use
 * @returns void
 */
export async function validateCohortSettingsOrFail(
  cxId: string,
  settings: AllOptionalSettings | undefined,
  log: typeof console.log
): Promise<void> {
  if (!settings) return;
  await validateMonitoringSettingsForCxOrFail(cxId, settings.monitoring, log);
  validateOverridesOrFail(settings.overrides);
}

/**
 * Validates that override keys match the "Exclude_<hieName>" format where hieName is one of the HIE names.
 *
 * @param overrides - The overrides
 * @throws BadRequestError if any override keys don't match the "Exclude_<hieName>" format
 */
export function validateOverridesOrFail(overrides: Overrides): void {
  if (!overrides) return;

  const validOverrides = getAvailableOverrides();
  const validOverridesSet = new Set(validOverrides);
  const invalidOverrides = Object.keys(overrides).filter(
    override => !validOverridesSet.has(override)
  );

  if (invalidOverrides.length > 0) {
    throw new BadRequestError(
      `Override keys must be in the format "Exclude_<hieName>", or ${STATE_VALIDATION_OVERRIDE_KEY}`,
      undefined,
      {
        invalidOverrides: invalidOverrides.join(", "),
        validOverrides: validOverrides.join(", "),
      }
    );
  }
}

export function getAvailableOverrides(): string[] {
  const hieNames = getHieNames();
  const validOverrides = new Set([
    ...hieNames.map(hieName => getExcludeHieNameString(hieName)),
    `${STATE_VALIDATION_OVERRIDE_KEY}`,
  ]);
  return Array.from(validOverrides);
}

/**
 * Validates if a CX is requesting a feature that is not enabled for the account.
 *
 * @param cxId - The ID of the CX
 * @param monitoring - The monitoring settings to validate
 * @param log - The log function to use
 * @returns void
 */
export async function validateMonitoringSettingsForCxOrFail(
  cxId: string,
  monitoring: AllOptionalMonitoringSettings | undefined,
  log: typeof console.log
): Promise<void> {
  log(`Validating monitoring settings for cx: ${cxId}`);
  if (!monitoring) return;

  if (monitoring.adt?.enabled) {
    const isAdtEnabled = await isAdtsRosterUploadFeatureFlagEnabledForCx(cxId);
    if (!isAdtEnabled) {
      throw new BadRequestError("ADT is not enabled for your account", undefined, {
        monitoringSettings: JSON.stringify(monitoring),
      });
    }
  }

  if (monitoring.pharmacy?.notifications) {
    const isSurescriptsNotificationsEnabled =
      await isSurescriptsNotificationsFeatureFlagEnabledForCx(cxId);
    if (!isSurescriptsNotificationsEnabled) {
      throw new BadRequestError(
        "Pharmacy Notifications are not enabled for your account",
        undefined,
        {
          monitoringSettings: JSON.stringify(monitoring),
        }
      );
    }
  }
  if (monitoring.pharmacy?.schedule && monitoring.pharmacy?.schedule.enabled) {
    const isSurescriptsEnabled = await isSurescriptsFeatureFlagEnabledForCx(cxId);
    if (!isSurescriptsEnabled) {
      throw new BadRequestError("Pharmacy Schedule is not enabled for your account", undefined, {
        monitoringSettings: JSON.stringify(monitoring),
      });
    }
  }

  const isCxRequestingQuest = monitoring.laboratory?.notifications;
  if (isCxRequestingQuest) {
    const isQuestEnabled = await isQuestFeatureFlagEnabledForCx(cxId);
    if (!isQuestEnabled) {
      throw new BadRequestError(
        "Laboratory Notifications are not enabled for your account",
        undefined,
        {
          monitoringSettings: JSON.stringify(monitoring),
        }
      );
    }
  }

  log(`Monitoring settings are valid for cx: ${cxId}`);
}
