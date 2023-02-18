#!/usr/bin/env node
import * as cdk from "aws-cdk-lib";
import "source-map-support/register";
import { APIStack } from "../lib/api-stack";
import { ConnectWidgetStack } from "../lib/connect-widget-stack";
import { EnvConfig } from "../lib/env-config";
import { EnvType } from "../lib/env-type";
import { SecretsStack } from "../lib/secrets-stack";

const app = new cdk.App();
//-------------------------------------------
// Parse config based on specified env
//-------------------------------------------
async function getConfig(): Promise<EnvConfig> {
  const env = app.node.tryGetContext("env");
  const validVals = Object.values(EnvType);
  if (!env || !validVals.includes(env)) {
    throw new Error(
      `Context variable missing on CDK command. Pass in as "-c env=XXX". Valid values are: ${validVals}`
    );
  }
  const configPath = `../config/${env}.ts`;
  const config = await import(configPath);
  if (!config || !config.default) {
    throw new Error(`Ensure config is defined, could not fine file ${configPath}`);
  }
  return config.default;
}

//-------------------------------------------
// Deploy the corresponding stacks
//-------------------------------------------
async function deploy() {
  const config = await getConfig();
  //---------------------------------------------------------------------------------
  // 1. Deploy the pre-requisites stack - it should be done prior to the other ones.
  //    Do this first, and then
  //    - manually set the "secrets" values in the AWS Secrets Manager.
  //    - deploy the FHIR server image to ECR
  //---------------------------------------------------------------------------------
  new SecretsStack(app, config.secretsStackName, {
    env: {
      // CDK_DEFAULT_ACCOUNT will come from your AWS CLI account profile you've setup.
      // To specify a different profile, you can use the profile flag. For example:
      //    cdk synth --profile prod-profile
      account: process.env.CDK_DEFAULT_ACCOUNT,
      region: config.region,
    },
    config,
  });

  //---------------------------------------------------------------------------------
  // 2. Deploy the API stack once all secrets are defined.
  //---------------------------------------------------------------------------------
  new APIStack(app, config.stackName, {
    env: {
      account: process.env.CDK_DEFAULT_ACCOUNT,
      region: config.region,
    },
    config: config,
  });

  if (config.connectWidget) {
    //---------------------------------------------------------------------------------
    // 3. Deploy the Connect widget stack.
    //---------------------------------------------------------------------------------
    new ConnectWidgetStack(app, config.connectWidget.stackName, {
      env: {
        account: process.env.CDK_DEFAULT_ACCOUNT,
        region: config.connectWidget.region,
      },
      config,
    });
  }
  app.synth();
}

deploy();
