import { getFeatureFlagValue } from "@metriport/core/external/aws/appConfig";
import { capture } from "@metriport/core/util/notifications";
import { errorToString } from "@metriport/shared/common/error";
import { Config } from "../../shared/config";
import { Util } from "../../shared/util";

const log = Util.log(`App Config`);

/**
 * Returns the list of Customer IDs that are enabled for the given feature flag.
 *
 * @returns Array of cxIds
 */
async function getCxsWithFeatureFlagValue(featureFlagName: string): Promise<string[]> {
  try {
    const featureFlag = await getFeatureFlagValue<{
      enabled: boolean | undefined;
      cxIds?: string[];
      cxIdsAndLimits?: string[];
    }>(
      Config.getAWSRegion(),
      Config.getAppConfigAppId(),
      Config.getAppConfigConfigId(),
      Config.getEnvType(),
      featureFlagName
    );
    if (featureFlag?.enabled) {
      if (featureFlag?.cxIds) return featureFlag.cxIds;
      if (featureFlag?.cxIdsAndLimits) return featureFlag.cxIdsAndLimits;
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
  return getCxsWithFeatureFlagValue(Config.getCxsWithEnhancedCoverageFeatureFlagName());
}

export async function getCxsWithCQDirectFeatureFlagValue(): Promise<string[]> {
  return getCxsWithFeatureFlagValue(Config.getCxsWithCQDirectFeatureFlagName());
}

export async function getCxsWithIncreasedSandboxLimitFeatureFlagValue(): Promise<
  string[] | undefined
> {
  const featureFlagValue = Config.getCxsWithIncreasedSandboxLimitFeatureFlagValue();
  if (!featureFlagValue) return;
  return getCxsWithFeatureFlagValue(featureFlagValue);
}

export async function isEnhancedCoverageEnabledForCx(cxId: string): Promise<boolean> {
  const cxIdsWithECEnabled = await getCxsWithEnhancedCoverageFeatureFlagValue();
  return cxIdsWithECEnabled.some(i => i === cxId);
}

export async function isCQDirectEnabledForCx(cxId: string): Promise<boolean> {
  const cxIdsWithCQDirectEnabled = await getCxsWithCQDirectFeatureFlagValue();
  return cxIdsWithCQDirectEnabled.some(i => i === cxId);
}
