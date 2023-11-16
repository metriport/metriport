import * as ecs from "aws-cdk-lib/aws-ecs";
import * as secret from "aws-cdk-lib/aws-secretsmanager";
import { Construct } from "constructs";
import { EnvConfig } from "../../config/env-config";

export type Secrets = { [key: string]: secret.ISecret };

export function getSecrets(scope: Construct, config: EnvConfig): Secrets {
  const secrets: Secrets = {};
  const buildSecrets = (secretNames: Record<string, string>) => {
    for (const [envVarName, secretName] of Object.entries(secretNames)) {
      secrets[envVarName] = secret.Secret.fromSecretNameV2(scope, secretName, secretName);
    }
  };
  buildSecrets(config.providerSecretNames);
  buildSecrets(config.cwSecretNames);
  buildSecrets(config.ihe);
  if (config.analyticsSecretNames) buildSecrets(config.analyticsSecretNames);
  return secrets;
}

export function secretsToECS(secrets: Secrets): Record<string, ecs.Secret> {
  const result: Record<string, ecs.Secret> = {};
  for (const [envVarName, secret] of Object.entries(secrets)) {
    result[envVarName] = ecs.Secret.fromSecretsManager(secret);
  }
  return result;
}
