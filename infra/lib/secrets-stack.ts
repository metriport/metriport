import { CfnOutput, Stack, StackProps } from "aws-cdk-lib";
import * as secret from "aws-cdk-lib/aws-secretsmanager";
import { Construct } from "constructs";
import { EnvConfig } from "./env-config";

interface SecretStackProps extends StackProps {
  config: EnvConfig;
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
      //-------------------------------------------
      // Output
      //-------------------------------------------
      new CfnOutput(this, `${secretName} ARN`, {
        value: secret.secretArn,
      });
    }

    for (const secretName of Object.values(props.config.cwSecretNames)) {
      const secret = makeSecret(secretName);
      //-------------------------------------------
      // Output
      //-------------------------------------------
      new CfnOutput(this, `${secretName} ARN`, {
        value: secret.secretArn,
      });
    }
  }
}
