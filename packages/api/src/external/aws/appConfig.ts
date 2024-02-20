import { FeatureFlagDatastore, getFeatureFlagValue } from "@metriport/core/external/aws/appConfig";
import { MetriportError } from "@metriport/core/util/error/metriport-error";
import { capture } from "@metriport/core/util/notifications";
import { errorToString } from "@metriport/shared/common/error";
import { Config } from "../../shared/config";
import { Util } from "../../shared/util";

const log = Util.log(`App Config - FF`);

const listOfFeatureFlags: Array<keyof FeatureFlagDatastore> = [
  "cxsWithEnhancedCoverageFeatureFlag",
  "cxsWithCQDirectFeatureFlag",
  "cxsWithADHDMRFeatureFlag",
  "cxsWithIncreasedSandboxLimitFeatureFlag",
  "cxsWithNoWebhookPongFeatureFlag",
];

/**
 * Go through all Feature Flags to make sure they are accessible.
 */
export async function initFeatureFlags() {
  if (Config.isDev()) {
    log(`Skipping initializing Feature Flags - Develop/Local env`);
    return;
  }
  const res = await Promise.allSettled(
    listOfFeatureFlags.map(ff =>
      getFeatureFlagValueLocal(ff).catch(initFeatureFlagsErrorHandling(ff))
    )
  );
  const failed = res.flatMap(r => (r.status === "rejected" ? r.reason : []));
  if (failed.length > 0) {
    throw new MetriportError(`Failed to initialize Feature Flags`, undefined, {
      failed: failed.map(f => f.reason).join("; "),
    });
  }
  log(`Feature Flags initialized.`);
}

function initFeatureFlagsErrorHandling(featureFlagName: keyof FeatureFlagDatastore) {
  return (error: unknown) => {
    const msg = `Failed to get Feature Flag Value`;
    const extra = { featureFlagName };
    log(`${msg} - ${JSON.stringify(extra)} - ${errorToString(error)}`);
    capture.error(msg, { extra: { ...extra, error } });
    throw error;
  };
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
 * @returns Array of cxIds or cxIdsAndLimits
 */
async function getCxsWithFeatureFlagEnabled(
  featureFlagName: keyof FeatureFlagDatastore
): Promise<string[]> {
  try {
    const featureFlag = await getFeatureFlagValueLocal(featureFlagName);
    if (featureFlag.enabled) {
      if (featureFlag.cxIds) return featureFlag.cxIds;
      if (featureFlag.cxIdsAndLimits) return featureFlag.cxIdsAndLimits;
    }
  } catch (error) {
    const msg = `Failed to get Feature Flag Value`;
    const extra = { featureFlagName };
    log(`${msg} - ${JSON.stringify(extra)} - ${errorToString(error)}`);
    capture.error(msg, { extra: { ...extra, error } });
  }
  return [];
}

export async function getCxsWithEnhancedCoverageFeatureFlagValue(): Promise<string[]> {
  return getCxsWithFeatureFlagEnabled("cxsWithEnhancedCoverageFeatureFlag");
}

export async function getCxsWithCQDirectFeatureFlagValue(): Promise<string[]> {
  return getCxsWithFeatureFlagEnabled("cxsWithCQDirectFeatureFlag");
}

export async function getCxsWithIncreasedSandboxLimitFeatureFlagValue(): Promise<string[]> {
  return getCxsWithFeatureFlagEnabled("cxsWithIncreasedSandboxLimitFeatureFlag");
}

export async function getCxsWithNoWebhookPongFeatureFlagValue(): Promise<string[]> {
  return getCxsWithFeatureFlagEnabled("cxsWithNoWebhookPongFeatureFlag");
}

export async function isEnhancedCoverageEnabledForCx(cxId: string): Promise<boolean> {
  const cxIdsWithECEnabled = await getCxsWithEnhancedCoverageFeatureFlagValue();
  return cxIdsWithECEnabled.some(i => i === cxId);
}

export async function isCQDirectEnabledForCx(cxId: string): Promise<boolean> {
  const cxIdsWithCQDirectEnabled = await getCxsWithCQDirectFeatureFlagValue();
  return cxIdsWithCQDirectEnabled.some(i => i === cxId);
}

export async function isNoWebhookPongEnabledForCx(cxId: string): Promise<boolean> {
  const cxIdsWithECEnabled = await getCxsWithNoWebhookPongFeatureFlagValue();
  return cxIdsWithECEnabled.some(i => i === cxId);
}
