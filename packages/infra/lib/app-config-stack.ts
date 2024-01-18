import { StackProps } from "aws-cdk-lib";
import * as appConfig from "aws-cdk-lib/aws-appconfig";
import { Construct } from "constructs";
import { EnvConfig } from "../config/env-config";

interface AppConfigStackProps extends StackProps {
  config: EnvConfig;
}

// TODO move these parameters to object properties
export function createAppConfigStack(
  stack: Construct,
  props: AppConfigStackProps
): {
  appConfigAppId: string;
  appConfigConfigId: string;
  cxsWithEnhancedCoverageFeatureFlag: string;
  cxsWithCQDirectFeatureFlag: string;
} {
  const appConfigOSSApp = new appConfig.CfnApplication(stack, "OSSAPIConfig", {
    name: "OSSAPIConfig",
  });

  const appConfigOSSProfile = new appConfig.CfnConfigurationProfile(stack, "OSSAPIConfigProfile", {
    applicationId: appConfigOSSApp.ref,
    locationUri: "hosted",
    name: "OSSAPIConfigProfile",
    type: "AWS.Freeform",
  });

  const cxsWithEnhancedCoverageFeatureFlag = "cxsWithEnhancedCoverage";
  const cxsWithCQDirectFeatureFlag = "cxsWithCQDirect";
  const appConfigOSSVersion = new appConfig.CfnHostedConfigurationVersion(
    stack,
    "OSSAPIConfigVersion",
    {
      applicationId: appConfigOSSApp.ref,
      configurationProfileId: appConfigOSSProfile.ref,
      contentType: "application/json",
      content: JSON.stringify({
        flags: {
          [cxsWithEnhancedCoverageFeatureFlag]: {
            name: cxsWithEnhancedCoverageFeatureFlag,
            attributes: {
              cxIds: {
                type: "string[]",
              },
            },
          },
          [cxsWithCQDirectFeatureFlag]: {
            name: cxsWithCQDirectFeatureFlag,
            attributes: {
              cxIds: {
                type: "string[]",
              },
            },
          },
        },
        values: {
          [cxsWithEnhancedCoverageFeatureFlag]: {
            enabled: true,
            cxIds: [],
          },
          [cxsWithCQDirectFeatureFlag]: {
            enabled: true,
            cxIds: [],
          },
        },
      }),
    }
  );

  const appConfigOSSEnv = new appConfig.CfnEnvironment(stack, "OSSAPIConfigEnv", {
    applicationId: appConfigOSSApp.ref,
    name: props.config.environmentType,
  });

  const appConfigOSSStrategy = new appConfig.CfnDeploymentStrategy(
    stack,
    "OSSAPIConfigDeploymentStrategy",
    {
      deploymentDurationInMinutes: 0,
      growthFactor: 100,
      name: "OSSAPIConfigDeploymentStrategy",
      replicateTo: "SSM_DOCUMENT",
      finalBakeTimeInMinutes: 0,
    }
  );

  new appConfig.CfnDeployment(stack, "OSSAPIConfigDeployment", {
    applicationId: appConfigOSSApp.ref,
    configurationProfileId: appConfigOSSProfile.ref,
    configurationVersion: appConfigOSSVersion.ref,
    environmentId: appConfigOSSEnv.ref,
    deploymentStrategyId: appConfigOSSStrategy.ref,
  });

  return {
    appConfigAppId: appConfigOSSApp.ref,
    appConfigConfigId: appConfigOSSProfile.ref,
    cxsWithEnhancedCoverageFeatureFlag,
    cxsWithCQDirectFeatureFlag,
  };
}
