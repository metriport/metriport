import { getFeatureFlagValue } from "@metriport/core/external/aws/appConfig";
import { Config } from "../../shared/config";
import { errorToString } from "../../shared/log";
import { capture } from "@metriport/core/util/notifications";

/**
 * Returns the list of Customer IDs that are enabled to use the Enhanced Coverage flow.
 *
 * @returns Array of cxIds
 */
export async function getCxsWithEnhancedCoverageFeatureFlagValue(): Promise<string[]> {
  try {
    const featureFlag = await getFeatureFlagValue<{
      enabled: boolean | undefined;
      cxIds: string[] | undefined;
    }>(
      Config.getAWSRegion(),
      Config.getAppConfigAppId(),
      Config.getAppConfigConfigId(),
      Config.getEnvType(),
      Config.getCxsWithEnhancedCoverageFeatureFlagName()
    );
    if (featureFlag?.enabled && featureFlag?.cxIds) return featureFlag.cxIds;
  } catch (error) {
    console.log(
      `Failed to get cxsWithEnhancedCoverage Feature Flag Value with error: ${errorToString(error)}`
    );
    capture.error(error, {
      extra: {
        context: `appConfig.getCxsWithEnhancedCoverageFeatureFlagValue`,
        error,
      },
    });
  }
  return [];
}

export async function isEnhancedCoverageEnabledForCx(cxId: string): Promise<boolean> {
  const cxIdsWithECEnabled = await getCxsWithEnhancedCoverageFeatureFlagValue();
  return cxIdsWithECEnabled.some(i => i === cxId);
}
