import {
  BooleanFeatureFlags,
  getFeatureFlags,
  getFeatureFlagValueBoolean,
  getFeatureFlagValueStringArray,
  StringValueFeatureFlags,
} from "@metriport/core/external/aws/app-config";
import { MetriportError } from "@metriport/core/util/error/metriport-error";
import { out } from "@metriport/core/util/log";
import { capture } from "@metriport/core/util/notifications";
import { errorToString, getEnvVar } from "@metriport/shared";
import { getCxIdFromApiKey } from "../../routes/middlewares/auth";
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

/**
 * Returns the list of customers that are enabled for the given feature flag.
 *
 * @returns Array of string values
 */
async function getCxsWithFeatureFlagEnabled(
  featureFlagName: keyof StringValueFeatureFlags
): Promise<string[]> {
  try {
    const featureFlag = await getFeatureFlagValueStringArray(
      Config.getAWSRegion(),
      Config.getAppConfigAppId(),
      Config.getAppConfigConfigId(),
      Config.getEnvType(),
      featureFlagName
    );
    if (featureFlag && featureFlag.enabled && featureFlag.values) {
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
async function isFeatureFlagEnabled(featureFlagName: keyof BooleanFeatureFlags): Promise<boolean> {
  try {
    const featureFlag = await getFeatureFlagValueBoolean(
      Config.getAWSRegion(),
      Config.getAppConfigAppId(),
      Config.getAppConfigConfigId(),
      Config.getEnvType(),
      featureFlagName
    );
    return featureFlag.enabled;
  } catch (error) {
    const msg = `Failed to get Feature Flag Value`;
    const extra = { featureFlagName };
    log(`${msg} - ${JSON.stringify(extra)} - ${errorToString(error)}`);
    capture.error(msg, { extra: { ...extra, error } });
  }
  return false;
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

export async function getOrgOidsWithIHEGatewayV2Enabled(): Promise<string[]> {
  return Config.isDev()
    ? Config.getOrgOidsWithIHEGatewayV2Enabled().split(",")
    : getCxsWithFeatureFlagEnabled("oidsWithIHEGatewayV2Enabled");
}

/**
 * getCxsWithIHEGatewayV2Enabled is used by isIHEGatewayV2EnabledForCx to check if a cx is enabled for IHE Gateway V2.
 * If it is, then in practice, isIHEGatewayV2EnabledForCx overrides getOrgOidsWithIHEGatewayV2Enabled because we will
 * enable all gateways. See @organization-conversion.ts for an example.
 */
export async function getCxsWithIHEGatewayV2Enabled(): Promise<string[]> {
  if (Config.isDev()) {
    const apiKey = getEnvVar("TEST_API_KEY");
    return apiKey ? [getCxIdFromApiKey(apiKey)] : [];
  }
  return getCxsWithFeatureFlagEnabled("cxsWithIHEGatewayV2Enabled");
}

export async function getE2eCxIds(): Promise<string | undefined> {
  if (Config.isDev()) {
    const apiKey = getEnvVar("TEST_API_KEY");
    return apiKey ? getCxIdFromApiKey(apiKey) : undefined;
  }
  const cxIds = await getCxsWithFeatureFlagEnabled("e2eCxIds");
  if (cxIds.length > 1) {
    const msg = `FF e2eCxIds should have 1 cxId`;
    log(`${msg} but it has ${cxIds.length}, using the first one.`);
    capture.message(msg, { extra: { cxIds }, level: "warning" });
  }
  return cxIds[0];
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

export async function isIHEGatewayV2EnabledForCx(cxId: string): Promise<boolean> {
  const cxIdsWithIHEGatewayV2Enabled = await getCxsWithIHEGatewayV2Enabled();
  return cxIdsWithIHEGatewayV2Enabled.some(i => i === cxId);
}

export async function isCommonwellEnabled(): Promise<boolean> {
  return isFeatureFlagEnabled("commonwellFeatureFlag");
}

export async function isCarequalityEnabled(): Promise<boolean> {
  return isFeatureFlagEnabled("carequalityFeatureFlag");
}
