import * as ecs from "aws-cdk-lib/aws-ecs";
import * as secret from "aws-cdk-lib/aws-secretsmanager";
import { Construct } from "constructs";
import { EnvConfig } from "../../config/env-config";
import { isSandbox } from "./util";
import { HieConfig, VpnlessHieConfig } from "@metriport/core/command/hl7v2-subscriptions/types";
import { getHieSftpPasswordSecretName } from "../secrets-stack";

export type Secrets = { [key: string]: secret.ISecret };

export function buildSecrets(scope: Construct, secretNames: Record<string, string>): Secrets {
  const secrets: Secrets = {};
  for (const [envVarName, secretName] of Object.entries(secretNames)) {
    secrets[envVarName] = buildSecret(scope, secretName);
  }
  return secrets;
}

export function buildSecret(scope: Construct, name: string): secret.ISecret {
  return secret.Secret.fromSecretNameV2(scope, name, name);
}

export function getSecrets(scope: Construct, config: EnvConfig): Secrets {
  const secrets: Secrets = {
    ...buildSecrets(scope, config.providerSecretNames),
    ...buildSecrets(scope, config.cwSecretNames),
    ...(config.carequality?.secretNames
      ? buildSecrets(scope, config.carequality.secretNames)
      : undefined),
    ...buildSecrets(scope, config.analyticsSecretNames),
    ...(config.canvas?.secretNames ? buildSecrets(scope, config.canvas.secretNames) : undefined),
    ...(config.ehrIntegration?.athenaHealth.secrets
      ? buildSecrets(scope, config.ehrIntegration.athenaHealth.secrets)
      : undefined),
    ...(config.ehrIntegration?.elation.secrets
      ? buildSecrets(scope, config.ehrIntegration.elation.secrets)
      : undefined),
    ...(config.ehrIntegration?.canvas.secrets
      ? buildSecrets(scope, config.ehrIntegration.canvas.secrets)
      : undefined),
    ...(config.ehrIntegration?.healthie.secrets
      ? buildSecrets(scope, config.ehrIntegration.healthie.secrets)
      : undefined),
    ...(config.hl7Notification?.secrets
      ? buildSecrets(scope, config.hl7Notification?.secrets)
      : undefined),
    ...(!isSandbox(config) ? buildSecrets(scope, config.analyticsPlatform.secretNames) : undefined),
    ...(!isSandbox(config)
      ? buildSecrets(scope, collectHiePasswordSecretNames(config.hl7Notification.hieConfigs))
      : undefined),
  };
  return secrets;
}

function collectHiePasswordSecretNames(
  hies: Record<string, HieConfig | VpnlessHieConfig>
): Record<string, string> {
  const out: Record<string, string> = {};
  for (const hieConfig of Object.values(hies)) {
    const secretName = getHieSftpPasswordSecretName(hieConfig.name);
    if (secretName) {
      out[secretName] = secretName;
    }
  }
  return out;
}

export function secretsToECS(secrets: Secrets): Record<string, ecs.Secret> {
  const result: Record<string, ecs.Secret> = {};
  for (const [envVarName, secret] of Object.entries(secrets)) {
    result[envVarName] = ecs.Secret.fromSecretsManager(secret);
  }
  return result;
}
