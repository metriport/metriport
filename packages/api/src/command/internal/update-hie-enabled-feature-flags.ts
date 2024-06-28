import {
  getFeatureFlags,
  createAndDeployConfigurationContent,
  StringValuesFF,
  CxFeatureFlagStatus,
} from "@metriport/core/external/aws/app-config";
import { out } from "@metriport/core/util/log";
import { Config } from "../../shared/config";

function enableFeatureFlagForCustomer(flag: StringValuesFF, cxId: string) {
  flag.values.push(cxId);
}

function disableFeatureFlagForCustomer(flag: StringValuesFF, cxId: string) {
  flag.values.filter(id => id !== cxId);
}

export async function updateCxHieEnabledFFs({
  cxId,
  cwEnabled,
  cqEnabled,
  epicEnabled,
}: {
  cxId: string;
  cwEnabled?: boolean;
  cqEnabled?: boolean;
  epicEnabled?: boolean;
}): Promise<CxFeatureFlagStatus> {
  const region = Config.getAWSRegion();
  const appId = Config.getAppConfigAppId();
  const configId = Config.getAppConfigConfigId();
  const envName = Config.getEnvType();
  const envId = Config.getAppConfigEnvironmentId();
  const deploymentStrategyId = Config.getAppConfigDeploymentStrategyId();
  const featureFlags = await getFeatureFlags(region, appId, configId, envName);
  if (cwEnabled === true) {
    enableFeatureFlagForCustomer(featureFlags.cxsWithCWFeatureFlag, cxId);
  } else if (cwEnabled === false) {
    disableFeatureFlagForCustomer(featureFlags.cxsWithCWFeatureFlag, cxId);
  }
  if (cqEnabled == true) {
    enableFeatureFlagForCustomer(featureFlags.cxsWithCQDirectFeatureFlag, cxId);
  } else if (cqEnabled === false) {
    disableFeatureFlagForCustomer(featureFlags.cxsWithCQDirectFeatureFlag, cxId);
  }
  if (epicEnabled == true) {
    enableFeatureFlagForCustomer(featureFlags.cxsWithEpicEnabled, cxId);
  } else if (epicEnabled == false) {
    disableFeatureFlagForCustomer(featureFlags.cxsWithEpicEnabled, cxId);
  }
  featureFlags.cxsWithCWFeatureFlag.values = [...new Set(featureFlags.cxsWithCWFeatureFlag.values)];
  featureFlags.cxsWithCQDirectFeatureFlag.values = [
    ...new Set(featureFlags.cxsWithCQDirectFeatureFlag.values),
  ];
  const newFeatureFlags = await createAndDeployConfigurationContent({
    region,
    appId,
    envId,
    configId,
    deploymentStrategyId,
    newContent: featureFlags,
  });
  const currentCwEnabled = newFeatureFlags.cxsWithCWFeatureFlag.values.includes(cxId);
  const currentCqEnabled = newFeatureFlags.cxsWithCQDirectFeatureFlag.values.includes(cxId);
  const currentEpicEnabled = newFeatureFlags.cxsWithCQDirectFeatureFlag.values.includes(cxId);
  const { log } = out(`Customer ${cxId}`);
  log(
    `New HIE enabled state: CW: ${currentCwEnabled} CQ: ${currentCqEnabled} Epic: ${currentEpicEnabled}`
  );
  return {
    cxsWithCWFeatureFlag: currentCwEnabled,
    cxsWithCQDirectFeatureFlag: currentCqEnabled,
  };
}
