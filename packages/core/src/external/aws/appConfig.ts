import { AppConfig } from "aws-sdk";

function makeAppConfigClient(region: string): AWS.AppConfig {
  return new AppConfig({ region });
}

export async function getFeatureFlagValue<T>(
  region: string,
  appId: string,
  configId: string,
  envName: string,
  featureFlagName: string
): Promise<T | undefined> {
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
  if (configContent && config.ContentType && config.ContentType === "application/json") {
    const configContentValue = JSON.parse(configContent.toString());
    if (configContentValue.values) return configContentValue.values[featureFlagName];
  }

  return undefined;
}
