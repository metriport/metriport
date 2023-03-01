import * as ecs from "aws-cdk-lib/aws-ecs";
import * as secret from "aws-cdk-lib/aws-secretsmanager";
import { Construct } from "constructs";
import { EnvConfig } from "./env-config";

export type Secrets = { [key: string]: ecs.Secret };

export function getSecrets(scope: Construct, config: EnvConfig): Secrets {
  const buildSecret = (name: string): secret.ISecret =>
    secret.Secret.fromSecretNameV2(scope, name, name);
  const secrets: Secrets = {};
  for (const key of Object.keys(config.providerSecretNames)) {
    secrets[key] = ecs.Secret.fromSecretsManager(
      buildSecret((config.providerSecretNames as { [index: string]: string })[key])
    );
  }
  for (const key of Object.keys(config.cwSecretNames)) {
    secrets[key] = ecs.Secret.fromSecretsManager(
      buildSecret((config.cwSecretNames as { [index: string]: string })[key])
    );
  }
  return secrets;
}
