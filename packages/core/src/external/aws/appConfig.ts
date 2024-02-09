import { AppConfig } from "aws-sdk";

function makeAppConfigClient(region: string): AWS.AppConfig {
  return new AppConfig({ region });
}

export type CustomerIdsFF = {
  enabled: boolean;
  cxIds: string[];
  cxIdsAndLimits: never;
};

export type SandboxLimitFF = {
  enabled: boolean;
  cxIdsAndLimits: string[];
  cxIds: never;
};

export type FeatureFlagDatastore = {
  cxsWithEnhancedCoverageFeatureFlag: CustomerIdsFF;
  cxsWithCQDirectFeatureFlag: CustomerIdsFF;
  cxsWithADHDMRFeatureFlag: CustomerIdsFF;
  cxsWithIncreasedSandboxLimitFeatureFlag: SandboxLimitFF;
};

export async function getFeatureFlagValue<T extends keyof FeatureFlagDatastore>(
  region: string,
  appId: string,
  configId: string,
  envName: string,
  featureFlagName: T
): Promise<FeatureFlagDatastore[T] | undefined> {
  const appConfig = makeAppConfigClient(region);
  const config = await appConfig
    .getConfiguration({
      Application: appId,
      Configuration: configId,
      Environment: envName,
      ClientId: featureFlagName,
    })
    .promise();
  const configContent = config.Content;
  console.log(
    `From config with appId=${appId} configId=${configId} envName=${envName} featureFlagName=${featureFlagName} - got config version: ${config.ConfigurationVersion}`
  );
  if (configContent && config.ContentType && config.ContentType === "application/json") {
    const configContentValue = JSON.parse(configContent.toString());
    if (configContentValue.values && configContentValue.values[featureFlagName])
      return configContentValue.values[featureFlagName];
    else throw new Error(`Feature Flag ${featureFlagName} not found in config`);
  }

  throw new Error(`Failed to get Feature Flag Value for ${featureFlagName}`);
}
