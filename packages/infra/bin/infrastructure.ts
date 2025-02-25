import * as cdk from "aws-cdk-lib";
import "source-map-support/register";
import { EnvConfig } from "../config/env-config";
import { APIStack } from "../lib/api-stack";
import { Hl7v2ApplicationStack } from "../lib/hl7v2-application-stack";
import { Hl7v2NetworkStack } from "../lib/hl7v2-network-stack";
import { LocationServicesStack } from "../lib/location-services-stack";
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
  // 1. Deploy the secrets stack to initialize all secrets.
  //    Do this first, and then manually set the values in the AWS Secrets Manager.
  //---------------------------------------------------------------------------------
  new SecretsStack(app, config.secretsStackName, { env, config });

  //---------------------------------------------------------------------------------
  // 2. Deploy the location services stack to initialize all geo services.
  //---------------------------------------------------------------------------------
  if (config.locationService) {
    new LocationServicesStack(app, config.locationService.stackName, {
      env: { ...env, region: config.locationService.placeIndexRegion },
      config,
    });
  }

  //---------------------------------------------------------------------------------
  // 3. Deploy the API stack once all secrets are defined.
  //---------------------------------------------------------------------------------
  new APIStack(app, config.stackName, { env, config, version });

  //---------------------------------------------------------------------------------
  // 4. Deploy the HL7v2 network stack.
  //---------------------------------------------------------------------------------
  const networkStack = new Hl7v2NetworkStack(app, "Hl7v2NetworkStack", {
    config: config,
  });

  //---------------------------------------------------------------------------------
  // 5. Deploy the HL7v2 application stack.
  //---------------------------------------------------------------------------------
  const applicationStack = new Hl7v2ApplicationStack(app, "Hl7v2ApplicationStack", {
    config: config,
    version: version,
    networkStack: networkStack.output,
  });

  // Make the application stack depend on the network stack
  applicationStack.addDependency(networkStack);

  //---------------------------------------------------------------------------------
  // Execute the updates on AWS
  //---------------------------------------------------------------------------------
  app.synth();
}

initConfig(app.node).then(config => deploy(config));
