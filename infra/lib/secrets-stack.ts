import { CfnOutput, RemovalPolicy, Stack, StackProps } from "aws-cdk-lib";
import * as ecr from "aws-cdk-lib/aws-ecr";
import * as secret from "aws-cdk-lib/aws-secretsmanager";
import { Construct } from "constructs";
import { EnvConfig } from "./env-config";

interface SecretStackProps extends StackProps {
  config: EnvConfig;
}

/**
 * This is a stack used for pre-requiresites, or assets that should be deployed
 * before the rest of the infrastructure.
 *
 * Originally called 'SecretsStack', we couldn't rename it because it would mean
 * recreating all secrets with existing applications being used in production.
 */
export class SecretsStack extends Stack {
  constructor(scope: Construct, id: string, props: SecretStackProps) {
    super(scope, id, props);

    const secrets = this.setupSecrets(props);

    const fhirECR = this.setupFHIRECR(props);

    //-------------------------------------------
    // Output
    //-------------------------------------------
    for (const s of secrets) {
      new CfnOutput(this, `${s.name} ARN`, {
        value: s.secretArn,
      });
    }
    new CfnOutput(this, `FHIR ECR ARN`, {
      value: fhirECR.repositoryArn,
    });
  }

  private setupSecrets(props: SecretStackProps): (secret.Secret & { name?: string })[] {
    const makeSecret = (name: string): secret.Secret =>
      new secret.Secret(this, name, {
        secretName: name,
        replicaRegions: props.config.secretReplicaRegion
          ? [{ region: props.config.secretReplicaRegion }]
          : [],
      });

    const secrets: (secret.Secret & { name?: string })[] = [];
    for (const secretName of Object.values(props.config.providerSecretNames)) {
      const secret: secret.Secret & { name?: string } = makeSecret(secretName);
      secret.name = secretName;
      secrets.push(secret);
    }
    return secrets;
  }

  private setupFHIRECR(props: SecretStackProps): ecr.IRepository {
    return new ecr.Repository(this, props.config.fhirServerECRName, {
      repositoryName: props.config.fhirServerECRName,
      removalPolicy: RemovalPolicy.DESTROY,
    });
  }
}
