import { AppConfig } from "aws-sdk";
import { MetriportError } from "../../util/error/metriport-error";
import { out } from "../../util/log";

const { log } = out(`Core appConfig - FF`);

function makeAppConfigClient(region: string): AWS.AppConfig {
  return new AppConfig({ region });
}

export type StringValuesFF = {
  enabled: boolean;
  values: string[];
};

export type BooleanFF = {
  enabled: boolean;
  values: never;
};

export type FeatureFlagDatastore = {
  cxsWithEnhancedCoverageFeatureFlag: StringValuesFF;
  cxsWithCQDirectFeatureFlag: StringValuesFF;
  cxsWithCWFeatureFlag: StringValuesFF;
  cxsWithADHDMRFeatureFlag: StringValuesFF;
  cxsWithNoWebhookPongFeatureFlag: StringValuesFF;
  cxsWithIncreasedSandboxLimitFeatureFlag: StringValuesFF;
  oidsWithGirthEnabled: StringValuesFF;
  commonwellFeatureFlag: BooleanFF;
  carequalityFeatureFlag: BooleanFF;
};

export async function getFeatureFlagValue<T extends keyof FeatureFlagDatastore>(
  region: string,
  appId: string,
  configId: string,
  envName: string,
  featureFlagName: T
): Promise<FeatureFlagDatastore[T]> {
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
  log(
    `From config with appId=${appId} configId=${configId} envName=${envName} ` +
      `featureFlagName=${featureFlagName} - got config version: ${config.ConfigurationVersion}`
  );
  if (configContent && config.ContentType && config.ContentType === "application/json") {
    const configContentValue = JSON.parse(configContent.toString());
    if (configContentValue && configContentValue[featureFlagName]) {
      return configContentValue[featureFlagName];
    } else {
      throw new MetriportError(`Feature Flag not found in config`, undefined, { featureFlagName });
    }
  }
  throw new MetriportError(`Failed to get Feature Flag Value`, undefined, { featureFlagName });
}
