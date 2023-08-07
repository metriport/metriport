import * as ecs from "aws-cdk-lib/aws-ecs";
import * as secret from "aws-cdk-lib/aws-secretsmanager";
import { Construct } from "constructs";
import { EnvConfig } from "../../config/env-config";

export type Secrets = { [key: string]: ecs.Secret };

export function buildSecrets(
  secrets: Secrets,
  scope: Construct,
  secretNames: Record<string, string>
) {
  for (const [key, value] of Object.entries(secretNames)) {
    secrets[key] = ecs.Secret.fromSecretsManager(
      secret.Secret.fromSecretNameV2(scope, value, value)
    );
  }
  return secrets;
}

export function getSecrets(scope: Construct, config: EnvConfig): Secrets {
  const secrets: Secrets = {};
  const buildSecrets = (secretNames: Record<string, string>) => {
    for (const [key, value] of Object.entries(secretNames)) {
      secrets[key] = ecs.Secret.fromSecretsManager(
        secret.Secret.fromSecretNameV2(scope, value, value)
      );
    }
  };

  buildSecrets(config.providerSecretNames);
  buildSecrets(config.cwSecretNames);
  if (config.analyticsSecretNames) buildSecrets(config.analyticsSecretNames);

  return secrets;
}
