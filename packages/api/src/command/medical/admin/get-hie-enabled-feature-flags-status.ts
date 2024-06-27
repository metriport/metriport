import { getFeatureFlags, CxFeatureFlagStatus } from "@metriport/core/external/aws/app-config";
import { Config } from "../../../shared/config";

export async function getHieEnabledFFStatus(cxId: string): Promise<CxFeatureFlagStatus> {
  const region = Config.getAWSRegion();
  const appId = Config.getAppConfigAppId();
  const configId = Config.getAppConfigConfigId();
  const envName = Config.getEnvType();
  const featureFlags = await getFeatureFlags(region, appId, configId, envName);
  return {
    cxsWithCWFeatureFlag: featureFlags.cxsWithCWFeatureFlag.values.includes(cxId),
    cxsWithCQDirectFeatureFlag: featureFlags.cxsWithCQDirectFeatureFlag.values.includes(cxId),
  };
}
