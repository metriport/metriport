import { errorToString } from "@metriport/shared";
import { AppConfig } from "aws-sdk";
import { z } from "zod";
import { Config } from "../../util/config";
import { MetriportError } from "../../util/error/metriport-error";
import { out } from "../../util/log";
import { capture } from "../../util/notifications";
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

export const cxBasedFFsSchema = z.object({
  cxsWithEnhancedCoverageFeatureFlag: ffStringValuesSchema,
  cxsWithCQDirectFeatureFlag: ffStringValuesSchema,
  cxsWithCWFeatureFlag: ffStringValuesSchema,
  cxsWithADHDMRFeatureFlag: ffStringValuesSchema,
  cxsWithNoMrLogoFeatureFlag: ffStringValuesSchema,
  cxsWithBmiMrFeatureFlag: ffStringValuesSchema,
  cxsWithDermMrFeatureFlag: ffStringValuesSchema,
  cxsWithAiBriefFeatureFlag: ffStringValuesSchema,
  getCxsWithCdaCustodianFeatureFlag: ffStringValuesSchema,
  cxsWithNoWebhookPongFeatureFlag: ffStringValuesSchema,
  cxsWithIncreasedSandboxLimitFeatureFlag: ffStringValuesSchema,
  cxsWithEpicEnabled: ffStringValuesSchema,
  cxsWithDemoAugEnabled: ffStringValuesSchema,
  cxsWithStalePatientUpdateEnabled: ffStringValuesSchema,
  cxsWithStrictMatchingAlgorithm: ffStringValuesSchema,
  cxsUsingWkhtmltopdfInsteadOfPuppeteer: ffStringValuesSchema, // TODO: 2510 - Remove this when ready to rollout to all customers
  cxsWithAthenaCustomFieldsEnabled: ffStringValuesSchema,
});
export type CxBasedFFsSchema = z.infer<typeof cxBasedFFsSchema>;

export const stringValueFFsSchema = cxBasedFFsSchema.merge(
  z.object({
    oidsWithIHEGatewayV2Enabled: ffStringValuesSchema,
    e2eCxIds: ffStringValuesSchema.nullish(),
  })
);
export type StringValueFeatureFlags = z.infer<typeof stringValueFFsSchema>;

export type CxFeatureFlagStatus = Partial<
  Record<keyof CxBasedFFsSchema, { cxInFFValues: boolean; ffEnabled: boolean }>
>;

export const ffDatastoreSchema = stringValueFFsSchema.merge(booleanFFsSchema);
export type FeatureFlagDatastore = z.infer<typeof ffDatastoreSchema>;

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

export async function getFeatureFlagValueCxValues<T extends keyof StringValueFeatureFlags>(
  region: string,
  appId: string,
  configId: string,
  envName: string,
  cxId: string,
  featureFlagNames?: T[]
): Promise<CxFeatureFlagStatus> {
  const configContentValue = await getFeatureFlags(region, appId, configId, envName);
  const targetFeatureFlags =
    featureFlagNames && featureFlagNames.length > 0
      ? featureFlagNames
      : stringValueFFsSchema.keyof().options;
  let response: CxFeatureFlagStatus = {};
  targetFeatureFlags.map(featureFlagName => {
    const featureFlag = configContentValue[featureFlagName];
    if (featureFlag) {
      response = {
        ...response,
        [featureFlagName]: {
          cxInFFValues: featureFlag.values.includes(cxId),
          ffEnabled: featureFlag.enabled,
        },
      };
    }
  });
  return response;
}

export async function getFeatureFlagValueStringArray<T extends keyof StringValueFeatureFlags>(
  region: string,
  appId: string,
  configId: string,
  envName: string,
  featureFlagName: T
): Promise<StringValueFeatureFlags[T]> {
  try {
    const configContentValue = await getFeatureFlags(region, appId, configId, envName);
    return configContentValue[featureFlagName];
  } catch (error) {
    const msg = `Failed to get Feature Flag Value`;
    const extra = { featureFlagName };
    log(`${msg} - ${JSON.stringify(extra)} - ${errorToString(error)}`);
    capture.error(msg, { extra: { ...extra, error } });
    return { enabled: false, values: [] };
  }
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

export async function createAndDeployConfigurationContent({
  region,
  appId,
  envId,
  configId,
  deploymentStrategyId,
  newContent,
}: {
  region: string;
  appId: string;
  envId: string;
  configId: string;
  deploymentStrategyId: string;
  newContent: FeatureFlagDatastore;
}): Promise<FeatureFlagDatastore> {
  const appConfig = makeAppConfigClient(region);
  const createConfigurationParams: AppConfig.CreateHostedConfigurationVersionRequest = {
    ApplicationId: appId,
    ConfigurationProfileId: configId,
    Description: `PROGRAMMATICALLY GENERATED VERSION BY ${clientId}`,
    Content: Buffer.from(JSON.stringify(newContent), "utf8"),
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
    DeploymentStrategyId: deploymentStrategyId,
    ConfigurationProfileId: configId,
    ConfigurationVersion: `${createConfigurationRsp.VersionNumber}`,
    Description: `PROGRAMMATIC DEPLOYMENT BY ${clientId}`,
  };
  await appConfig.startDeployment(startDeploymentRequestParams).promise();
  const configString = createConfigurationRsp.Content.toString();
  return JSON.parse(configString);
}

/**
 * Checks whether the specified feature flag is enabled.
 *
 * @returns true if enabled; false otherwise
 */
export async function isFeatureFlagEnabled(
  featureFlagName: keyof BooleanFeatureFlags,
  defaultValue = false
): Promise<boolean> {
  try {
    const featureFlag = await getFeatureFlagValueBoolean(
      Config.getAWSRegion(),
      Config.getAppConfigAppId(),
      Config.getAppConfigConfigId(),
      Config.getEnvType(),
      featureFlagName
    );
    return featureFlag ? featureFlag.enabled : defaultValue;
  } catch (error) {
    const msg = `Failed to get Feature Flag Value`;
    const extra = { featureFlagName };
    log(`${msg} - ${JSON.stringify(extra)} - ${errorToString(error)}`);
    capture.error(msg, { extra: { ...extra, error } });
  }
  return defaultValue;
}

/**
 * Returns the list of customers that are enabled for the given feature flag.
 *
 * @returns Array of string values
 */
export async function getCxsWithFeatureFlagEnabled(
  featureFlagName: keyof StringValueFeatureFlags
): Promise<string[]> {
  try {
    const featureFlag = await getFeatureFlagValueStringArray(
      Config.getAWSRegion(),
      Config.getAppConfigAppId(),
      Config.getAppConfigConfigId(),
      Config.getEnvType(),
      featureFlagName
    );
    if (featureFlag && featureFlag.enabled) {
      return featureFlag.values;
    }
  } catch (error) {
    const msg = `Failed to get Feature Flag Value`;
    const extra = { featureFlagName };
    log(`${msg} - ${JSON.stringify(extra)} - ${errorToString(error)}`);
    capture.error(msg, { extra: { ...extra, error } });
  }
  return [];
}

export async function getCxsWithAiBriefFeatureFlagValue(): Promise<string[]> {
  return getCxsWithFeatureFlagEnabled("cxsWithAiBriefFeatureFlag");
}

export async function isStrictMatchingAlgorithmEnabledForCx(cxId: string): Promise<boolean> {
  const cxsWithStrictMatchingAlgorithmEnabled = await getCxsWithStrictMatchingAlgorithm();
  return cxsWithStrictMatchingAlgorithmEnabled.includes(cxId);
}

export async function getCxsWithStrictMatchingAlgorithm(): Promise<string[]> {
  return getCxsWithFeatureFlagEnabled("cxsWithStrictMatchingAlgorithm");
}

export async function isAiBriefFeatureFlagEnabledForCx(cxId: string): Promise<boolean> {
  const cxsWithADHDFeatureFlagValue = await getCxsWithAiBriefFeatureFlagValue();
  return cxsWithADHDFeatureFlagValue.includes(cxId);
}

export async function isWkhtmltopdfEnabledForCx(cxId: string): Promise<boolean> {
  const cxIdsWithWkhtmltopdfEnabled = await getCxsUsingWkhtmltopdfInsteadOfPuppeteer();
  return cxIdsWithWkhtmltopdfEnabled.some(i => i === cxId);
}
export async function getCxsUsingWkhtmltopdfInsteadOfPuppeteer(): Promise<string[]> {
  return getCxsWithFeatureFlagEnabled("cxsUsingWkhtmltopdfInsteadOfPuppeteer");
}

export async function isAthenaCustomFieldsEnabledForCx(cxId: string): Promise<boolean> {
  const cxsWithAthenaCustomFieldsEnabled = await getCxsWithAthenaCustomFieldsEnabled();
  return cxsWithAthenaCustomFieldsEnabled.includes(cxId);
}

export async function getCxsWithAthenaCustomFieldsEnabled(): Promise<string[]> {
  return getCxsWithFeatureFlagEnabled("cxsWithAthenaCustomFieldsEnabled");
}
