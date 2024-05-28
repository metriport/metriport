import { StackProps } from "aws-cdk-lib";
import * as appConfig from "aws-cdk-lib/aws-appconfig";
import { Construct } from "constructs";
import { EnvConfig } from "../config/env-config";

interface AppConfigStackProps extends StackProps {
  config: EnvConfig;
}

export function createAppConfigStack({
  stack,
  props,
}: {
  stack: Construct;
  props: AppConfigStackProps;
}): {
  appConfigAppId: string;
  appConfigConfigId: string;
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

  new appConfig.CfnEnvironment(stack, "OSSAPIConfigEnv", {
    applicationId: appConfigOSSApp.ref,
    name: props.config.environmentType,
  });

  new appConfig.CfnDeploymentStrategy(stack, "OSSAPIConfigDeploymentStrategy", {
    deploymentDurationInMinutes: 0,
    growthFactor: 100,
    name: "OSSAPIConfigDeploymentStrategy",
    replicateTo: "SSM_DOCUMENT",
    finalBakeTimeInMinutes: 0,
  });

  return {
    appConfigAppId: appConfigOSSApp.ref,
    appConfigConfigId: appConfigOSSProfile.ref,
  };
}
