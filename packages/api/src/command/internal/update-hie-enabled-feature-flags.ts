import {
  getFeatureFlags,
  createAndDeployHieConfigurationContent,
  CxFeatureFlagStatus,
} from "@metriport/core/external/aws/app-config";
import { Config } from "../../shared/config";

export async function updateHieEnabledFFs({
  cxId,
  cwEnabled,
  cqEnabled,
}: {
  cxId: string;
  cwEnabled?: boolean;
  cqEnabled?: boolean;
}): Promise<CxFeatureFlagStatus> {
  const region = Config.getAWSRegion();
  const appId = Config.getAppConfigAppId();
  const configId = Config.getAppConfigConfigId();
  const envName = Config.getEnvType();
  const envId = Config.getAppConfigEnvironmentId();
  const deploymentStrategyId = Config.getAppConfigDeploymentStrategyId();
  const featureFlags = await getFeatureFlags(region, appId, configId, envName);
  if (cwEnabled === true) {
    featureFlags.cxsWithCWFeatureFlag.values.push(cxId);
  } else if (cwEnabled === false) {
    featureFlags.cxsWithCWFeatureFlag.values = featureFlags.cxsWithCWFeatureFlag.values.filter(
      id => id !== cxId
    );
  }
  if (cqEnabled == true) {
    featureFlags.cxsWithCQDirectFeatureFlag.values.push(cxId);
  } else if (cqEnabled === false) {
    featureFlags.cxsWithCQDirectFeatureFlag.values =
      featureFlags.cxsWithCQDirectFeatureFlag.values.filter(id => id !== cxId);
  }
  featureFlags.cxsWithCWFeatureFlag.values = [...new Set(featureFlags.cxsWithCWFeatureFlag.values)];
  featureFlags.cxsWithCQDirectFeatureFlag.values = [
    ...new Set(featureFlags.cxsWithCQDirectFeatureFlag.values),
  ];
  const newFeatureFlags = await createAndDeployHieConfigurationContent({
    region,
    appId,
    envId,
    configId,
    deploymentStrategyId,
    newContent: featureFlags,
  });
  return {
    cxsWithCWFeatureFlag: newFeatureFlags.cxsWithCWFeatureFlag.values.includes(cxId),
    cxsWithCQDirectFeatureFlag: newFeatureFlags.cxsWithCQDirectFeatureFlag.values.includes(cxId),
  };
}
