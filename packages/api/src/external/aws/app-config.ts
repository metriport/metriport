import {
  BooleanFeatureFlags,
  getFeatureFlags,
  getFeatureFlagValueBoolean,
  getCxsWithFeatureFlagEnabled,
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

export async function getCxsWithEpicEnabled(): Promise<string[]> {
  return getCxsWithFeatureFlagEnabled("cxsWithEpicEnabled");
}

export async function getCxsWithAiBriefFeatureFlag(): Promise<string[]> {
  return getCxsWithFeatureFlagEnabled("cxsWithAiBriefFeatureFlag");
}

export async function getCxsWithFhirDedupFeatureFlag(): Promise<string[]> {
  return getCxsWithFeatureFlagEnabled("cxsWithFhirDedupFeatureFlag");
}

export async function getCxsWitDemoAugEnabled(): Promise<string[]> {
  return getCxsWithFeatureFlagEnabled("cxsWithDemoAugEnabled");
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

export async function isE2eCx(cxId: string): Promise<boolean> {
  const e2eCxId = await getE2eCxIds();
  return e2eCxId === cxId;
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
  const cxIdsWithNoWebhookPong = await getCxsWithNoWebhookPongFeatureFlagValue();
  return cxIdsWithNoWebhookPong.some(i => i === cxId);
}

export async function isAiBriefEnabledForCx(cxId: string): Promise<boolean> {
  const cxIdsWithAiBriefEnabled = await getCxsWithAiBriefFeatureFlag();
  return cxIdsWithAiBriefEnabled.some(i => i === cxId);
}

export async function isFhirDeduplicationEnabledForCx(cxId: string): Promise<boolean> {
  const cxIdsWithFhirDedupEnabled = await getCxsWithFhirDedupFeatureFlag();
  return cxIdsWithFhirDedupEnabled.some(i => i === cxId);
}

export async function isEpicEnabledForCx(cxId: string): Promise<boolean> {
  const cxIdsWithEpicEnabled = await getCxsWithEpicEnabled();
  return cxIdsWithEpicEnabled.some(i => i === cxId);
}

export async function isDemoAugEnabledForCx(cxId: string): Promise<boolean> {
  const cxIdsWithDemoAugEnabled = await getCxsWitDemoAugEnabled();
  return cxIdsWithDemoAugEnabled.some(i => i === cxId);
}

export async function isCommonwellEnabled(): Promise<boolean> {
  return isFeatureFlagEnabled("commonwellFeatureFlag");
}

export async function isCarequalityEnabled(): Promise<boolean> {
  return isFeatureFlagEnabled("carequalityFeatureFlag");
}
