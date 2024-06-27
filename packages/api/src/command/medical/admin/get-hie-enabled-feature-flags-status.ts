import {
  getDeployments,
  getConfigurationContent,
  CxFeatureFlagStatus,
} from "@metriport/core/external/aws/app-config";
import { Config } from "../../../shared/config";

export async function getHieEnabledFFStatus(cxId: string): Promise<CxFeatureFlagStatus> {
  const region = Config.getAWSRegion();
  const appId = Config.getAppConfigAppId();
  const configId = Config.getAppConfigConfigId();
  const envId = Config.getAppConfigEnvironmentId();
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
  return {
    cxsWithCWFeatureFlag: featureFlags.cxsWithCWFeatureFlag.values.includes(cxId),
    cxsWithCQDirectFeatureFlag: featureFlags.cxsWithCQDirectFeatureFlag.values.includes(cxId),
  };
}
