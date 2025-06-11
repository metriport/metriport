import { CfnOutput, Stack, StackProps } from "aws-cdk-lib";
import * as secret from "aws-cdk-lib/aws-secretsmanager";
import { Construct } from "constructs";
import { EnvConfig } from "../config/env-config";
import { isSandbox } from "../lib/shared/util";
import { PROBLEMATIC_IPSEC_CHARACTERS } from "./hl7-notification-stack/constants";

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

    this.terminationProtection = true;

    //-------------------------------------------
    // Init secrets for the infra stack
    //-------------------------------------------
    const makeSecret = (name: string, options?: secret.SecretProps): secret.Secret =>
      new secret.Secret(this, name, {
        secretName: name,
        replicaRegions: props.config.secretReplicaRegion
          ? [{ region: props.config.secretReplicaRegion }]
          : [],
        ...options,
      });

    if (props.config.carequality?.roUsername) {
      const secretName = props.config.carequality.roUsername;
      if (secretName === "") throw new Error("RO CQ DB Creds secret name not set");
      const secret = makeSecret(secretName);
      logSecretInfo(this, secret, secretName);
    }

    for (const secretName of Object.values(props.config.providerSecretNames)) {
      const secret = makeSecret(secretName);
      logSecretInfo(this, secret, secretName);
    }

    for (const secretName of Object.values<string | undefined>(props.config.cwSecretNames)) {
      if (!secretName || !secretName.trim().length) continue;
      const secret = makeSecret(secretName);
      logSecretInfo(this, secret, secretName);
    }

    if (props.config.carequality?.secretNames) {
      for (const secretName of Object.values<string | undefined>(
        props.config.carequality.secretNames
      )) {
        if (!secretName || !secretName.trim().length) continue;
        const secret = makeSecret(secretName);
        logSecretInfo(this, secret, secretName);
      }
    }

    const ehrSecrets = {
      ...props.config.canvas?.secretNames,
      ...props.config.ehrIntegration?.athenaHealth.secrets,
      ...props.config.ehrIntegration?.elation.secrets,
      ...props.config.ehrIntegration?.canvas.secrets,
      ...props.config.ehrIntegration?.healthie.secrets,
    };

    if (Object.keys(ehrSecrets).length) {
      for (const secretName of Object.values<string | undefined>(ehrSecrets)) {
        if (!secretName || !secretName.trim().length) continue;
        const secret = makeSecret(secretName);
        logSecretInfo(this, secret, secretName);
      }
    }

    for (const secretName of Object.values(props.config.analyticsSecretNames)) {
      const secret = makeSecret(secretName);
      logSecretInfo(this, secret, secretName);
    }

    if (props.config.surescripts) {
      for (const secretName of Object.values(props.config.surescripts.secrets)) {
        const secret = makeSecret(secretName);
        logSecretInfo(this, secret, secretName);
      }
    }

    if (!isSandbox(props.config)) {
      for (const secretName of Object.values(props.config.hl7Notification.secrets)) {
        const secret = makeSecret(secretName);
        logSecretInfo(this, secret, secretName);
      }

      const vpnTunnelSecretNames = props.config.hl7Notification.vpnConfigs.flatMap(config => [
        `PresharedKey1-${config.partnerName}`,
        `PresharedKey2-${config.partnerName}`,
      ]);
      for (const secretName of vpnTunnelSecretNames) {
        const secret = makeSecret(secretName, {
          generateSecretString: {
            excludePunctuation: true,
            excludeCharacters: PROBLEMATIC_IPSEC_CHARACTERS,
          },
        });
        logSecretInfo(this, secret, secretName);
      }
    }
  }
}
