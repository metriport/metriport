#!/usr/bin/env node
import * as cdk from "aws-cdk-lib";
import "source-map-support/register";
import { APIStack } from "../lib/api-stack";
import { BaseStack } from "../lib/base-stack";
import { ConnectWidgetStack } from "../lib/connect-widget-stack";
import { EnvConfig } from "../lib/env-config";
import { FHIRConnectorStack } from "../lib/fhir-connector-stack";
import { LambdasStack } from "../lib/lambdas-stack";
import { SecretsStack } from "../lib/secrets-stack";
import { initConfig } from "../lib/shared/config";
import { getEnvVar } from "../lib/shared/util";

const app = new cdk.App();

//-------------------------------------------
// Deploy the corresponding stacks
//-------------------------------------------
async function deploy(config: EnvConfig) {
  // CDK_DEFAULT_ACCOUNT will come from your AWS CLI account profile you've setup.
  // To specify a different profile, you can use the profile flag. For example:
  //    cdk synth --profile prod-profile
  const env = {
    account: getEnvVar("CDK_DEFAULT_ACCOUNT"),
    region: config.region,
  };
  const version = getEnvVar("METRIPORT_VERSION");

  //---------------------------------------------------------------------------------
  // Basic, shared infrastructure.
  //---------------------------------------------------------------------------------
  const baseStack = new BaseStack(app, "BaseStack", { env, config });

  //---------------------------------------------------------------------------------
  // Deploy the secrets stack to initialize all secrets.
  //---------------------------------------------------------------------------------
  new SecretsStack(app, config.secretsStackName, { env, config });

  //---------------------------------------------------------------------------------
  // Creates the basic infra for interacting with FHIR converters and server.
  //---------------------------------------------------------------------------------
  const fhirConnectorsStack = new FHIRConnectorStack(app, "FHIRConnectorStack", {
    env,
    config,
    alarmAction: baseStack.alarmAction,
  });
  const fhirConverterConnectorARNs = FHIRConnectorStack.toARNs(
    fhirConnectorsStack.fhirConverterConnector
  );
  const sidechainFHIRConverterConnectorARNs = FHIRConnectorStack.toARNs(
    fhirConnectorsStack.sidechainFHIRConverterConnector
  );
  const fhirServerConnectorARNs = FHIRConnectorStack.toARNs(
    fhirConnectorsStack.fhirServerConnector
  );

  //---------------------------------------------------------------------------------
  // Main stack defining some core infrastructure.
  //---------------------------------------------------------------------------------
  const apiStack = new APIStack(app, config.stackName, {
    env,
    config,
    version,
    lambdaLayers: baseStack.lambdaLayers,
    fhirConverterConnectorARNs,
    sidechainFHIRConverterConnectorARNs,
    fhirServerConnectorARNs,
    alarmAction: baseStack.alarmAction,
  });

  //---------------------------------------------------------------------------------
  // Deploy the Connect widget stack.
  //---------------------------------------------------------------------------------
  if (config.connectWidget) {
    new ConnectWidgetStack(app, config.connectWidget.stackName, {
      env: { ...env, region: config.connectWidget.region },
      config,
    });
  }

  //---------------------------------------------------------------------------------
  // Lambdas are deployed last, because they depend on other stacks.
  //---------------------------------------------------------------------------------
  new LambdasStack(app, "LambdasStack", {
    env,
    config,
    vpc: apiStack.vpc,
    lambdaLayers: baseStack.lambdaLayers,
    apiService: apiStack.apiService,
    apiServiceDnsAddress: apiStack.apiServiceDnsAddress,
    medicalDocumentsBucket: apiStack.medicalDocumentsBucket,
    apiGateway: apiStack.apiGateway,
    dynamoDBTokenTable: apiStack.dynamoDBTokenTable,
    alarmAction: baseStack.alarmAction,
    fhirConverterConnectorARNs,
    sidechainFHIRConverterConnectorARNs,
    fhirServerConnectorARNs,
    apiTaskDefArn: apiStack.apiService.taskDefinition.taskDefinitionArn,
    apiTaskRoleArn: apiStack.apiService.taskDefinition.taskRole.roleArn,
  });

  //---------------------------------------------------------------------------------
  // Execute the updates on AWS
  //---------------------------------------------------------------------------------
  app.synth();
}

initConfig(app.node).then(config => deploy(config));
