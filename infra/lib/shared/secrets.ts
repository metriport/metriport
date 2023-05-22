import * as ecs from "aws-cdk-lib/aws-ecs";
import * as secret from "aws-cdk-lib/aws-secretsmanager";
import { Construct } from "constructs";
import { EnvConfig } from "../env-config";

export type Secrets = { [key: string]: ecs.Secret };

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

  // TODO 706 temporary until FHIR converter is ready to pull messages from the queue
  const fhirConverterSecretName = "fhirConverterUrl";
  secrets["FHIR_CONVERTER_SERVER_URL"] = ecs.Secret.fromSecretsManager(
    secret.Secret.fromSecretNameV2(scope, fhirConverterSecretName, fhirConverterSecretName)
  );

  return secrets;
}
