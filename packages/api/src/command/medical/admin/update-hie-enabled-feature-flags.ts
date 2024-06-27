import {
  getDeployments,
  getConfigurationContent,
  createAndDeployHieConfigurationContent,
  CxFeatureFlagStatus,
} from "@metriport/core/external/aws/app-config";
import { Config } from "../../../shared/config";

export async function updateHieEnabledFFs({
  cxId,
  cwEnabled,
  cqEndabled,
}: {
  cxId: string;
  cwEnabled?: boolean;
  cqEndabled?: boolean;
}): Promise<CxFeatureFlagStatus> {
  const region = Config.getAWSRegion();
  const appId = Config.getAppConfigAppId();
  const configId = Config.getAppConfigConfigId();
  const envId = Config.getAppConfigEnvironmentId();
  const deploymentStratId = Config.getAppConfigDeploymentStrategyId();
  const deployments = await getDeployments({
    region,
    appId,
    envId,
  });
  const deploymentsLatestToEarliest = deployments
    .sort((a, b) => (a.DeploymentNumber ?? -1) - (b.DeploymentNumber ?? -1))
    .reverse();
  const latestDeployment = deploymentsLatestToEarliest[0];
  if (!latestDeployment) {
    throw new Error("Invalid latest deployment");
  }
  const featureFlags = await getConfigurationContent({
    region,
    appId,
    envId,
    configId,
    deployment: latestDeployment,
  });
  if (cwEnabled === true) {
    featureFlags.cxsWithCWFeatureFlag.values.push(cxId);
  } else if (cwEnabled === false) {
    featureFlags.cxsWithCWFeatureFlag.values = featureFlags.cxsWithCWFeatureFlag.values.filter(
      id => id !== cxId
    );
  }
  if (cqEndabled == true) {
    featureFlags.cxsWithCQDirectFeatureFlag.values.push(cxId);
  } else if (cqEndabled === false) {
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
    deploymentStratId,
    newContent: featureFlags,
  });
  return {
    cxsWithCWFeatureFlag: newFeatureFlags.cxsWithCWFeatureFlag.values.includes(cxId),
    cxsWithCQDirectFeatureFlag: newFeatureFlags.cxsWithCQDirectFeatureFlag.values.includes(cxId),
  };
}
