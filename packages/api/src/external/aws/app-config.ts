import {
  FeatureFlagDatastore,
  getFeatureFlags,
  getFeatureFlagValue,
} from "@metriport/core/external/aws/app-config";
import { MetriportError } from "@metriport/core/util/error/metriport-error";
import { out } from "@metriport/core/util/log";
import { capture } from "@metriport/core/util/notifications";
import { errorToString } from "@metriport/shared/common/error";
import { Config } from "../../shared/config";

const { log } = out(`App Config - FF`);

/**
 * Go through all Feature Flags to make sure they are accessible.
 */
export async function initFeatureFlags() {
  if (Config.isDev()) {
    log(`Skipping initializing Feature Flags - Develop/Local env`);
    return;
  }
  try {
    await getFeatureFlags(
      Config.getAWSRegion(),
      Config.getAppConfigAppId(),
      Config.getAppConfigConfigId(),
      Config.getEnvType()
    );
  } catch (error) {
    throw new MetriportError(`Failed to initialize Feature Flags`, error);
  }
  log(`Feature Flags initialized.`);
}

function getFeatureFlagValueLocal(featureFlagName: keyof FeatureFlagDatastore) {
  return getFeatureFlagValue(
    Config.getAWSRegion(),
    Config.getAppConfigAppId(),
    Config.getAppConfigConfigId(),
    Config.getEnvType(),
    featureFlagName
  );
}

/**
 * Returns the list of customers that are enabled for the given feature flag.
 *
 * @returns Array of string values
 */
async function getCxsWithFeatureFlagEnabled(
  featureFlagName: keyof FeatureFlagDatastore
): Promise<string[]> {
  try {
    const featureFlag = await getFeatureFlagValueLocal(featureFlagName);
    if (featureFlag.enabled && featureFlag.values) {
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

/**
 * Checks whether the specified feature flag is enabled.
 *
 * @returns true if enabled; false otherwise
 */
async function isFeatureFlagEnabled(featureFlagName: keyof FeatureFlagDatastore): Promise<boolean> {
  let isEnabled = false;
  try {
    const featureFlag = await getFeatureFlagValueLocal(featureFlagName);
    isEnabled = featureFlag.enabled;
  } catch (error) {
    const msg = `Failed to get Feature Flag Value`;
    const extra = { featureFlagName };
    log(`${msg} - ${JSON.stringify(extra)} - ${errorToString(error)}`);
    capture.error(msg, { extra: { ...extra, error } });
  }
  return isEnabled;
}

export async function getCxsWithEnhancedCoverageFeatureFlagValue(): Promise<string[]> {
  return getCxsWithFeatureFlagEnabled("cxsWithEnhancedCoverageFeatureFlag");
}

export async function getCxsWithCQDirectFeatureFlagValue(): Promise<string[]> {
  return getCxsWithFeatureFlagEnabled("cxsWithCQDirectFeatureFlag");
}

export async function getCxsWithCWFeatureFlagValue(): Promise<string[]> {
  return getCxsWithFeatureFlagEnabled("cxsWithCWFeatureFlag");
}

export async function getCxsWithIncreasedSandboxLimitFeatureFlagValue(): Promise<string[]> {
  return getCxsWithFeatureFlagEnabled("cxsWithIncreasedSandboxLimitFeatureFlag");
}

export async function getCxsWithNoWebhookPongFeatureFlagValue(): Promise<string[]> {
  return getCxsWithFeatureFlagEnabled("cxsWithNoWebhookPongFeatureFlag");
}

export async function getOidsWithIHEGatewayV2Enabled(): Promise<string[]> {
  return getCxsWithFeatureFlagEnabled("oidsWithIHEGatewayV2Enabled");
}

export async function isEnhancedCoverageEnabledForCx(cxId: string): Promise<boolean> {
  const cxIdsWithECEnabled = await getCxsWithEnhancedCoverageFeatureFlagValue();
  return cxIdsWithECEnabled.some(i => i === cxId);
}

export async function isCQDirectEnabledForCx(cxId: string): Promise<boolean> {
  const cxIdsWithCQDirectEnabled = await getCxsWithCQDirectFeatureFlagValue();
  return cxIdsWithCQDirectEnabled.some(i => i === cxId);
}

export async function isCWEnabledForCx(cxId: string): Promise<boolean> {
  const cxIdsWithCWDirectEnabled = await getCxsWithCWFeatureFlagValue();
  return cxIdsWithCWDirectEnabled.some(i => i === cxId);
}

export async function isWebhookPongDisabledForCx(cxId: string): Promise<boolean> {
  const cxIdsWithECEnabled = await getCxsWithNoWebhookPongFeatureFlagValue();
  return cxIdsWithECEnabled.some(i => i === cxId);
}

export async function isCommonwellEnabled(): Promise<boolean> {
  return isFeatureFlagEnabled("commonwellFeatureFlag");
}

export async function isCarequalityEnabled(): Promise<boolean> {
  return isFeatureFlagEnabled("carequalityFeatureFlag");
}
