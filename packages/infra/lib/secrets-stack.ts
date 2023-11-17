import { CfnOutput, Stack, StackProps } from "aws-cdk-lib";
import * as secret from "aws-cdk-lib/aws-secretsmanager";
import { Construct } from "constructs";
import { EnvConfig } from "../config/env-config";

interface SecretStackProps extends StackProps {
  config: EnvConfig;
}

function logSecretInfo(stack: Construct, secret: secret.Secret, secretName: string) {
  //-------------------------------------------
  // Output
  //-------------------------------------------
  new CfnOutput(stack, `${secretName} ARN`, {
    value: secret.secretArn,
  });
}

export class SecretsStack extends Stack {
  constructor(scope: Construct, id: string, props: SecretStackProps) {
    super(scope, id, props);

    //-------------------------------------------
    // Init secrets for the infra stack
    //-------------------------------------------
    const makeSecret = (name: string): secret.Secret =>
      new secret.Secret(this, name, {
        secretName: name,
        replicaRegions: props.config.secretReplicaRegion
          ? [{ region: props.config.secretReplicaRegion }]
          : [],
      });

    for (const secretName of Object.values(props.config.providerSecretNames)) {
      const secret = makeSecret(secretName);
      logSecretInfo(this, secret, secretName);
    }

    for (const secretName of Object.values<string | undefined>(props.config.cwSecretNames)) {
      if (!secretName || !secretName.trim().length) continue;
      const secret = makeSecret(secretName);
      logSecretInfo(this, secret, secretName);
    }

    if (props.config.analyticsSecretNames) {
      for (const secretName of Object.values(props.config.analyticsSecretNames)) {
        const secret = makeSecret(secretName);
        logSecretInfo(this, secret, secretName);
      }
    }
  }
}
