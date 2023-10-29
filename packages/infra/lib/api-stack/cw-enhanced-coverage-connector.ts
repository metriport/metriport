import { Duration, SecretValue } from "aws-cdk-lib";
import { SnsAction } from "aws-cdk-lib/aws-cloudwatch-actions";
import { IVpc } from "aws-cdk-lib/aws-ec2";
import { IFunction, ILayerVersion } from "aws-cdk-lib/aws-lambda";
import * as secret from "aws-cdk-lib/aws-secretsmanager";
import { Construct } from "constructs";
import { SessionManagementConfig } from "../../config/env-config";
import { getConfig } from "../shared/config";
import { createScheduledLambda } from "../shared/lambda-scheduled";
import { Secrets } from "../shared/secrets";

export function settings(): {
  connectorName: string;
  scheduledLambda: {
    scheduleExpression: string[];
    memory: number;
    timeout: Duration;
  };
  // chunkingLambda: {
  //   memory: number;
  //   batchSize: number;
  //   // maxConcurrency: number;
  //   timeout: Duration;
  // };
  // includeListLambda: {
  //   // memory: number;
  //   // batchSize: number;
  //   // maxConcurrency: number;
  //   // timeout: Duration;
  // };
  // sqsPatients: {
  //   // HAS TO BE FIFO, cxId as the messageGroupId
  //   // maxReceiveCount: number;
  //   // visibilityTimeout: Duration;
  //   // delayWhenRetrying: Duration;
  // };
  // sqsOrgChunks: {
  //   // HAS TO BE FIFO, cxId as the messageGroupId
  //   // maxReceiveCount: number;
  //   // visibilityTimeout: Duration;
  //   // delayWhenRetrying: Duration;
  // };
} {
  // How long can the lambda run for, max is 900 seconds (15 minutes)
  // const timeoutChunkingLambda = Duration.minutes(15).minus(Duration.seconds(5));
  // const timeoutIncludeListLambda = Duration.minutes(15).minus(Duration.seconds(5));
  return {
    connectorName: "CWEnhancedCoverage",
    scheduledLambda: {
      scheduleExpression: ["10 * * * ? *"],
      memory: 512,
      // How long can the lambda run for, max is 900 seconds (15 minutes)
      timeout: Duration.minutes(15).minus(Duration.seconds(5)),
    },
    // chunkingLambda: {
    //   memory: 512,
    //   // Number of messages the lambda pull from SQS at once
    //   // TODO VALIDATE THIS
    //   // TODO VALIDATE THIS
    //   // TODO VALIDATE THIS
    //   // TODO VALIDATE THIS
    //   batchSize: 100,
    //   // Max number of concurrent instances of the lambda that an Amazon SQS event source can invoke [2 - 1000].
    //   // maxConcurrency: isLarge ? 10 : 5,
    //   // How long can the lambda run for, max is 900 seconds (15 minutes)
    //   timeout: timeoutChunkingLambda,
    // },
    // includeListLambda: {
    //   memory: 512,
    //   // Number of messages the lambda pull from SQS at once
    //   batchSize: 1,
    //   // Max number of concurrent instances of the lambda that an Amazon SQS event source can invoke [2 - 1000].
    //   maxConcurrency: isLarge ? 10 : 5,
    //   // How long can the lambda run for, max is 900 seconds (15 minutes)
    //   timeout: timeoutIncludeListLambda,
    // },
    // sqsPatients: {
    //   // Number of times we want to retry a message, this includes throttles!
    //   maxReceiveCount: 2,
    //   // How long messages should be invisible for other consumers, based on the lambda timeout
    //   // We don't care if the message gets reprocessed, so no need to have a huge visibility timeout that makes it harder to move messages to the DLQ
    //   visibilityTimeout: Duration.seconds(timeout.toSeconds() * 2 + 1),
    //   delayWhenRetrying: Duration.seconds(10),
    // },
    // sqsOrgChunks: {
    //   // Number of times we want to retry a message, this includes throttles!
    //   maxReceiveCount: 2,
    //   // How long messages should be invisible for other consumers, based on the lambda timeout
    //   // We don't care if the message gets reprocessed, so no need to have a huge visibility timeout that makes it harder to move messages to the DLQ
    //   visibilityTimeout: Duration.seconds(timeout.toSeconds() * 2 + 1),
    //   delayWhenRetrying: Duration.seconds(10),
    // },
  };
}

export function setup({
  stack,
  vpc,
  lambdaLayers,
  secrets,
  alarmSnsAction,
}: {
  stack: Construct;
  vpc: IVpc;
  lambdaLayers: ILayerVersion[];
  secrets: Secrets;
  alarmSnsAction?: SnsAction;
}):
  | {
      sessionLambda: IFunction;
    }
  | undefined {
  const config = getConfig();
  if (!config.commonwell.sessionManagement) {
    console.log(`CW session management is not enabled, skipping...`);
    return undefined;
  }

  const credsStore = setupCredsStore(secrets);
  if (!credsStore) throw new Error(`Could not setup credentials for CW Management`);

  const cookieStore = createCookiesStore(stack);
  const codeChallengeStore = createCodeChallengeStore(stack);

  // create scheduled lambda to keep session active
  const sessionLambda = createSessionMgmtLambda({
    stack,
    vpc,
    lambdaLayers,
    sessionConfig: config.commonwell.sessionManagement,
    credsStore,
    cookieStore,
    codeChallengeStore,
    alarmSnsAction,
  });

  // create patient queue
  // TODO 1195

  // create lambda to batch orgs + patients
  // TODO 1195

  // create batch queue
  // TODO 1195

  // create lambda to process batch
  // TODO 1195

  return {
    sessionLambda,
  };
}

function setupCredsStore(secrets: Secrets): secret.ISecret | undefined {
  const config = getConfig();
  // A bit of gymnastic to get a compilation error if we change the name of the env var
  const envVarName: Extract<keyof typeof config.cwSecretNames, "CW_MANAGEMENT_CREDS"> =
    "CW_MANAGEMENT_CREDS";
  return secrets[envVarName];
}

function createCookiesStore(stack: Construct): secret.Secret {
  const { connectorName } = settings();
  const name = connectorName + "CookieSecret";
  // Not an actual secret that needs to be set prior to the deployment, this is more a
  // single value storage, that's why we're not creating it on the SecretsStack
  return new secret.Secret(stack, name, {
    secretName: name,
    /**
     * Do not use this method for any secrets that you care about!
     * The value will be visible to anyone who has access to the CloudFormation template
     * (via the AWS Console, SDKs, or CLI).
     */
    secretStringValue: SecretValue.unsafePlainText(JSON.stringify({})),
  });
}

function createCodeChallengeStore(stack: Construct): secret.Secret {
  const { connectorName } = settings();
  const name = connectorName + "CodeChallengeSecret";
  // Not an actual secret that needs to be set prior to the deployment, this is more a
  // single value storage, that's why we're not creating it on the SecretsStack
  return new secret.Secret(stack, name, { secretName: name });
}

function createSessionMgmtLambda({
  stack,
  vpc,
  lambdaLayers,
  sessionConfig,
  credsStore,
  cookieStore,
  codeChallengeStore,
  alarmSnsAction,
}: {
  stack: Construct;
  vpc: IVpc;
  lambdaLayers: ILayerVersion[];
  sessionConfig: SessionManagementConfig;
  credsStore: secret.ISecret;
  cookieStore: secret.Secret;
  codeChallengeStore: secret.Secret;
  alarmSnsAction?: SnsAction;
}): IFunction {
  const config = getConfig();
  const cwBaseUrl = sessionConfig.url;
  const notificationUrl = sessionConfig.codeChallengeNotificationUrl;

  const {
    connectorName,
    scheduledLambda: { memory, timeout, scheduleExpression },
  } = settings();
  const lambda = createScheduledLambda({
    stack,
    name: connectorName,
    scheduleExpression,
    vpc,
    subnets: vpc.privateSubnets,
    entry: "cw-session-management",
    layers: lambdaLayers,
    memory,
    envVars: {
      ENV_TYPE: config.environmentType,
      COOKIE_SECRET_ARN: cookieStore.secretArn,
      CODE_CHALLENGE_SECRET_ARN: codeChallengeStore.secretArn,
      CW_CREDS_NOTIF_URL: notificationUrl,
      CW_CREDS_SECRET_NAME: credsStore.secretName,
      CW_URL: cwBaseUrl,
      ...(config.lambdasSentryDSN ? { SENTRY_DSN: config.lambdasSentryDSN } : {}),
    },
    timeout,
    alarmSnsAction,
  });

  credsStore.grantRead(lambda);

  cookieStore.grantRead(lambda);
  cookieStore.grantWrite(lambda);

  codeChallengeStore.grantRead(lambda);
  codeChallengeStore.grantWrite(lambda);

  return lambda;
}
