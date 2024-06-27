import { AppConfig } from "aws-sdk";
import { z } from "zod";
import { MetriportError } from "../../util/error/metriport-error";
import { out } from "../../util/log";
import { uuidv4 } from "../../util/uuid-v7";

const { log } = out(`Core appConfig - FF`);

const clientId = uuidv4();

function makeAppConfigClient(region: string): AppConfig {
  return new AppConfig({ region });
}

export const ffStringValuesSchema = z.object({
  enabled: z.boolean(),
  values: z.string().array(),
});
export type StringValuesFF = z.infer<typeof ffStringValuesSchema>;

export const ffBooleanSchema = z.object({
  enabled: z.boolean(),
});
export type BooleanFF = z.infer<typeof ffBooleanSchema>;

export const booleanFFsSchema = z.object({
  commonwellFeatureFlag: ffBooleanSchema,
  carequalityFeatureFlag: ffBooleanSchema,
});
export type BooleanFeatureFlags = z.infer<typeof booleanFFsSchema>;

export const stringValueFFsSchema = z.object({
  cxsWithEnhancedCoverageFeatureFlag: ffStringValuesSchema,
  cxsWithCQDirectFeatureFlag: ffStringValuesSchema,
  cxsWithCWFeatureFlag: ffStringValuesSchema,
  cxsWithADHDMRFeatureFlag: ffStringValuesSchema,
  cxsWithNoWebhookPongFeatureFlag: ffStringValuesSchema,
  cxsWithIncreasedSandboxLimitFeatureFlag: ffStringValuesSchema,
  oidsWithIHEGatewayV2Enabled: ffStringValuesSchema,
  cxsWithIHEGatewayV2Enabled: ffStringValuesSchema,
  cxsWithEpicEnabled: ffStringValuesSchema,
  e2eCxIds: ffStringValuesSchema.nullish(),
});
export type StringValueFeatureFlags = z.infer<typeof stringValueFFsSchema>;

export const ffDatastoreSchema = stringValueFFsSchema.merge(booleanFFsSchema);
export type FeatureFlagDatastore = z.infer<typeof ffDatastoreSchema>;

export type CxFeatureFlagStatus = {
  cxsWithCWFeatureFlag: boolean;
  cxsWithCQDirectFeatureFlag: boolean;
};

export async function getFeatureFlags(
  region: string,
  appId: string,
  configId: string,
  envName: string
): Promise<FeatureFlagDatastore> {
  const appConfig = makeAppConfigClient(region);
  const config = await appConfig
    .getConfiguration({
      Application: appId,
      Configuration: configId,
      Environment: envName,
      ClientId: clientId,
    })
    .promise();
  // TODO we should store this on each call, so the SDK will only retrieve the config again if the deployed version changes
  // let version = config.ConfigurationVersion;
  const configContent = config.Content;
  log(
    `From config with appId=${appId} configId=${configId} envName=${envName} ` +
      ` - got config version: ${config.ConfigurationVersion}`
  );
  if (configContent && config.ContentType && config.ContentType === "application/json") {
    return ffDatastoreSchema.parse(JSON.parse(configContent.toString()));
  }
  throw new MetriportError(`Failed to get Feature Flags`);
}

export async function getFeatureFlagValueStringArray<T extends keyof StringValueFeatureFlags>(
  region: string,
  appId: string,
  configId: string,
  envName: string,
  featureFlagName: T
): Promise<StringValueFeatureFlags[T]> {
  const configContentValue = await getFeatureFlags(region, appId, configId, envName);
  return configContentValue[featureFlagName];
}

export async function getFeatureFlagValueBoolean<T extends keyof BooleanFeatureFlags>(
  region: string,
  appId: string,
  configId: string,
  envName: string,
  featureFlagName: T
): Promise<BooleanFeatureFlags[T]> {
  const configContentValue = await getFeatureFlags(region, appId, configId, envName);
  return configContentValue[featureFlagName];
}

export async function getDeployments({
  region,
  appId,
  envId,
}: {
  region: string;
  appId: string;
  envId: string;
}): Promise<AppConfig.Deployment[]> {
  const appConfig = makeAppConfigClient(region);
  const listDeploymentsBasepParams = {
    ApplicationId: appId,
    EnvironmentId: envId,
  };
  let deployments: AppConfig.Deployment[] = [];
  let nextToken: string | null | undefined;
  while (nextToken !== null) {
    const listDeploymentsParams = {
      ...listDeploymentsBasepParams,
      ...(nextToken ? { NextToken: nextToken } : undefined),
    };
    const listDeploymentsRsp = await appConfig.listDeployments(listDeploymentsParams).promise();
    deployments = [...deployments, ...(listDeploymentsRsp.Items ?? [])];
    if (listDeploymentsRsp.NextToken) {
      nextToken = listDeploymentsRsp.NextToken;
    } else {
      nextToken = null;
    }
  }
  return deployments;
}

export async function getConfigurationContent({
  region,
  appId,
  envId,
  configId,
  deployment,
}: {
  region: string;
  appId: string;
  envId: string;
  configId: string;
  deployment: AppConfig.Deployment;
}): Promise<FeatureFlagDatastore> {
  if (!deployment.ConfigurationVersion) {
    throw new Error("Invalid deployment ConfigurationVersion");
  }
  const appConfig = makeAppConfigClient(region);
  const getConfigurationParams: AppConfig.GetConfigurationRequest = {
    Application: appId,
    Environment: envId,
    Configuration: configId,
    ClientId: clientId,
    ClientConfigurationVersion: deployment.ConfigurationVersion,
  };
  const getConfigurationRsp = await appConfig.getConfiguration(getConfigurationParams).promise();
  if (!getConfigurationRsp.Content) {
    throw new Error("Invalid configuration Content");
  }
  const configString = getConfigurationRsp.Content.toString();
  return JSON.parse(configString);
}

export async function createAndDeployHieConfigurationContent({
  region,
  appId,
  envId,
  configId,
  deploymentStratId,
  newContent,
}: {
  region: string;
  appId: string;
  envId: string;
  configId: string;
  deploymentStratId: string;
  newContent: FeatureFlagDatastore;
}): Promise<FeatureFlagDatastore> {
  const appConfig = makeAppConfigClient(region);
  const createConfigurationParams: AppConfig.CreateHostedConfigurationVersionRequest = {
    ApplicationId: appId,
    ConfigurationProfileId: configId,
    Description: `PROGRAMMATICALLY GENERATED VERSION BY ${clientId}`,
    Content: new Blob([JSON.stringify(newContent)], { type: "application/json" }),
    ContentType: "application/json",
  };
  const createConfigurationRsp = await appConfig
    .createHostedConfigurationVersion(createConfigurationParams)
    .promise();
  if (!createConfigurationRsp.Content) {
    throw new Error("Invalid created configuration Content");
  }
  if (!createConfigurationRsp.VersionNumber) {
    throw new Error("Invalid created configuration VersionNumber");
  }
  const startDeploymentRequestParams: AppConfig.StartDeploymentRequest = {
    ApplicationId: appId,
    EnvironmentId: envId,
    DeploymentStrategyId: deploymentStratId,
    ConfigurationProfileId: configId,
    ConfigurationVersion: `${createConfigurationRsp.VersionNumber}`,
    Description: `PROGRAMMATIC DEPLOYMENT BY ${clientId}`,
  };
  await appConfig.startDeployment(startDeploymentRequestParams).promise();
  const configString = createConfigurationRsp.Content.toString();
  return JSON.parse(configString);
}
