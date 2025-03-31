import { errorToString } from "@metriport/shared";
import { out } from "../../util/log";
import { capture } from "../../util/notifications";
import { getFeatureFlags } from "./ffs-on-dynamodb";
import {
  BooleanFeatureFlags,
  CxFeatureFlagStatus,
  StringValueFeatureFlags,
  stringValueFFsSchema,
} from "./types";

const { log } = out(`FFs`);

export async function getFeatureFlagValueCxValues<T extends keyof StringValueFeatureFlags>(
  cxId: string,
  featureFlagNames?: T[]
): Promise<CxFeatureFlagStatus> {
  const configContentValue = await getFeatureFlags();
  const targetFeatureFlags =
    featureFlagNames && featureFlagNames.length > 0
      ? featureFlagNames
      : stringValueFFsSchema.keyof().options;
  let response: CxFeatureFlagStatus = {};
  targetFeatureFlags.map(featureFlagName => {
    const featureFlag = configContentValue[featureFlagName];
    if (featureFlag) {
      response = {
        ...response,
        [featureFlagName]: {
          cxInFFValues: featureFlag.values.includes(cxId),
          ffEnabled: featureFlag.enabled,
        },
      };
    }
  });
  return response;
}

export async function getFeatureFlagValueStringArray<T extends keyof StringValueFeatureFlags>(
  featureFlagName: T
): Promise<StringValueFeatureFlags[T]> {
  try {
    const configContentValue = await getFeatureFlags();
    return configContentValue[featureFlagName];
  } catch (error) {
    const msg = `Failed to get Feature Flag Value`;
    const extra = { featureFlagName };
    log(`${msg} - ${JSON.stringify(extra)} - ${errorToString(error)}`);
    capture.error(msg, { extra: { ...extra, error } });
    return { enabled: false, values: [] };
  }
}

export async function getFeatureFlagValueBoolean<T extends keyof BooleanFeatureFlags>(
  featureFlagName: T
): Promise<BooleanFeatureFlags[T]> {
  const configContentValue = await getFeatureFlags();
  return configContentValue[featureFlagName];
}

/**
 * Checks whether the specified feature flag is enabled.
 *
 * @returns true if enabled; false otherwise
 */
export async function isFeatureFlagEnabled(
  featureFlagName: keyof BooleanFeatureFlags,
  defaultValue = false
): Promise<boolean> {
  try {
    const featureFlag = await getFeatureFlagValueBoolean(featureFlagName);
    return featureFlag ? featureFlag.enabled : defaultValue;
  } catch (error) {
    const msg = `Failed to get Feature Flag Value`;
    const extra = { featureFlagName };
    log(`${msg} - ${JSON.stringify(extra)} - ${errorToString(error)}`);
    capture.error(msg, { extra: { ...extra, error } });
  }
  return defaultValue;
}

/**
 * Returns the list of customers that are enabled for the given feature flag.
 *
 * @returns Array of string values
 */
export async function getCxsWithFeatureFlagEnabled(
  featureFlagName: keyof StringValueFeatureFlags
): Promise<string[]> {
  try {
    const featureFlag = await getFeatureFlagValueStringArray(featureFlagName);
    if (featureFlag && featureFlag.enabled) {
      return featureFlag.values;
    }
  } catch (error) {
    const msg = `Failed to get Feature Flag Value`;
    const extra = { featureFlagName };
    log(`${msg} - ${JSON.stringify(extra)} - ${errorToString(error)}`);
    capture.error(msg, { extra: { ...extra, error } });
  }
  return [];
}

export async function getCxsWithAiBriefFeatureFlagValue(): Promise<string[]> {
  return getCxsWithFeatureFlagEnabled("cxsWithAiBriefFeatureFlag");
}

export async function isStrictMatchingAlgorithmEnabledForCx(cxId: string): Promise<boolean> {
  const cxsWithStrictMatchingAlgorithmEnabled = await getCxsWithStrictMatchingAlgorithm();
  return cxsWithStrictMatchingAlgorithmEnabled.includes(cxId);
}

export async function getCxsWithStrictMatchingAlgorithm(): Promise<string[]> {
  return getCxsWithFeatureFlagEnabled("cxsWithStrictMatchingAlgorithm");
}

export async function isAiBriefFeatureFlagEnabledForCx(cxId: string): Promise<boolean> {
  const cxsWithADHDFeatureFlagValue = await getCxsWithAiBriefFeatureFlagValue();
  return cxsWithADHDFeatureFlagValue.includes(cxId);
}

export async function isWkhtmltopdfEnabledForCx(cxId: string): Promise<boolean> {
  const cxIdsWithWkhtmltopdfEnabled = await getCxsUsingWkhtmltopdfInsteadOfPuppeteer();
  return cxIdsWithWkhtmltopdfEnabled.some(i => i === cxId);
}
export async function getCxsUsingWkhtmltopdfInsteadOfPuppeteer(): Promise<string[]> {
  return getCxsWithFeatureFlagEnabled("cxsUsingWkhtmltopdfInsteadOfPuppeteer");
}

export async function isAthenaCustomFieldsEnabledForCx(cxId: string): Promise<boolean> {
  const cxsWithAthenaCustomFieldsEnabled = await getCxsWithAthenaCustomFieldsEnabled();
  return cxsWithAthenaCustomFieldsEnabled.includes(cxId);
}

export async function getCxsWithAthenaCustomFieldsEnabled(): Promise<string[]> {
  return getCxsWithFeatureFlagEnabled("cxsWithAthenaCustomFieldsEnabled");
}
