import { AppConfig } from "aws-sdk";

function makeAppConfigClient(region: string): AWS.AppConfig {
  return new AppConfig({ region });
}

export type RegularType = {
  enabled: boolean;
  cxIds: string[];
};
export type OddType = {
  enabled: boolean;
  cxIdsAndLimits: string[];
};
export type FeatureFlagsStructure = {
  cxsWithEnhancedCoverageFeatureFlag: RegularType;
  cxsWithCQDirectFeatureFlag: RegularType;
  cxsWithIncreasedSandboxLimitFeatureFlag: OddType;
};

export async function getFeatureFlagValue<T extends keyof FeatureFlagsStructure>(
  region: string,
  appId: string,
  configId: string,
  envName: string,
  featureFlagName: T
): Promise<FeatureFlagsStructure[T] | undefined> {
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
    // Heads up! This is a bit of a hack ('.values' is of type 'any'). We should probably use a type guard here.
    if (configContentValue.values) return configContentValue.values[featureFlagName];
  }

  return undefined;
}
