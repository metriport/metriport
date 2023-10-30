import { getFeatureFlagValue } from "@metriport/core/external/aws/appConfig";
import { Config } from "../../shared/config";
import { errorToString } from "../../shared/log";
import { capture } from "../../shared/notifications";

export async function getCxsWithEnhancedCoverageFeatureFlagValue(): Promise<string[]> {
  try {
    const cxIds = await getFeatureFlagValue<string[]>(
      Config.getAWSRegion(),
      Config.getAppConfigAppId(),
      Config.getAppConfigConfigId(),
      Config.getEnvType(),
      Config.getCxsWithEnhancedCoverageFeatureFlagName()
    );
    return cxIds ? cxIds : [];
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
