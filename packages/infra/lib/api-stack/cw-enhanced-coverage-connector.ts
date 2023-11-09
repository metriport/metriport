import { Duration, SecretValue } from "aws-cdk-lib";
import { SnsAction } from "aws-cdk-lib/aws-cloudwatch-actions";
import { IVpc } from "aws-cdk-lib/aws-ec2";
import { IFunction, ILayerVersion } from "aws-cdk-lib/aws-lambda";
import { SqsEventSource } from "aws-cdk-lib/aws-lambda-event-sources";
import { IBucket } from "aws-cdk-lib/aws-s3";
import * as secret from "aws-cdk-lib/aws-secretsmanager";
import * as sqs from "aws-cdk-lib/aws-sqs";
import { Construct } from "constructs";
import { CWCoverageEnhancementConfig } from "../../config/env-config";
import { EnvType } from "../env-type";
import { getConfig } from "../shared/config";
import { createLambda } from "../shared/lambda";
import { LambdaLayers } from "../shared/lambda-layers";
import { createScheduledLambda } from "../shared/lambda-scheduled";
import { Secrets } from "../shared/secrets";
import { createQueue, provideAccessToQueue } from "../shared/sqs";
import { isProd, isStaging } from "../shared/util";

type Settings = {
  connectorName: string;
  sessionManagementLambda: {
    /**
     * UTC-based: "Minutes Hours Day-of-month Month Day-of-week Year"
     * @see: https://docs.aws.amazon.com/eventbridge/latest/userguide/eb-cron-expressions.html
     * @see: https://docs.aws.amazon.com/lambda/latest/dg/services-cloudwatchevents-expressions.html
     */
    scheduleExpression: string[];
    memory: number;
    timeout: Duration;
  };
  linkPatientsLambda: {
    memory: number; // Memory in MB
    batchSize: number; // Number of messages the lambda pull from SQS at once
    reportBatchItemFailures: boolean; // Allow functions to return partially successful responses for a batch of records.
    timeout: Duration; // How long can the lambda run for, max is 900 seconds (15 minutes)
  };
  sqsLinkPatients: {
    receiveMessageWaitTime: Duration; // Default wait time for ReceiveMessage calls.
    maxReceiveCount: number; // The number of times a message can be unsuccesfully dequeued before being moved to the dead-letter queue - this includes throttles!
    visibilityTimeout: Duration; // Timeout of processing a single message.
  };
};

export function settings(): Settings {
  const config = getConfig();
  // Every 10min, 8am EST thru 8pm PST, Mon-Fri
  const prodSchedule = ["0/10 12-3 ? * MON-SAT *"];
  // TODO 1195 remove the schedule, we want to run this manually on staging
  // Every hour, 10am EST thru 8pm PST, Mon-Fri
  const stagingSchedule = ["0/10 14-3 ? * MON-SAT *"];
  // How long can the lambda run for, max is 900 seconds (15 minutes)
  const timeoutLinkPatientsLambda = Duration.minutes(15).minus(Duration.seconds(5));
  return {
    connectorName: "CWEnhancedCoverage",
    sessionManagementLambda: {
      scheduleExpression: isProd(config) ? prodSchedule : isStaging(config) ? stagingSchedule : [],
      memory: 512,
      timeout: Duration.minutes(15).minus(Duration.seconds(5)),
    },
    linkPatientsLambda: {
      memory: 512,
      batchSize: 1,
      reportBatchItemFailures: true,
      timeout: Duration.minutes(15).minus(Duration.seconds(5)),
    },
    sqsLinkPatients: {
      receiveMessageWaitTime: Duration.seconds(20),
      maxReceiveCount: 5,
      visibilityTimeout: Duration.seconds(timeoutLinkPatientsLambda.toSeconds() * 2 + 1),
    },
  };
}

export function setup({
  stack,
  vpc,
  lambdaLayers,
  envType,
  secrets,
  bucket,
  alarmSnsAction,
}: {
  stack: Construct;
  vpc: IVpc;
  lambdaLayers: LambdaLayers;
  envType: EnvType;
  secrets: Secrets;
  bucket: IBucket;
  alarmSnsAction?: SnsAction;
}):
  | {
      sessionLambda: IFunction;
      linkPatientQueue: sqs.IQueue;
      linkPatientsLambda: IFunction;
    }
  | undefined {
  // TODO 1195 Either remove or re-enable this and finish building it
  // const config = getConfig();
  // const coverageConfig = config.commonwell.coverageEnhancement;
  const coverageConfig = {} as CWCoverageEnhancementConfig;
  if (!coverageConfig) {
    console.log(`CW coverage enhancement is not enabled, skipping...`);
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
    lambdaLayers: [lambdaLayers.shared, lambdaLayers.playwright],
    coverageConfig,
    credsStore,
    cookieStore,
    codeChallengeStore,
    bucket,
    alarmSnsAction,
  });

  // queue to get the group of patients + CQ orgs
  const linkPatientQueue = createLinkPatientQueue(stack, lambdaLayers, envType);

  // lambda to batch patients + CQ orgs
  // const patientGroupingLambda = createPatientsGroupingLambda({
  //   stack,
  //   vpc,
  //   lambdaLayers,
  //   outputQueue: linkPatientQueue,
  //   bucket,
  //   coverageConfig,
  //   alarmSnsAction,
  // });

  // lambda link patients to CQ orgs
  const linkPatientsLambda = createLinkPatientsLambda({
    stack,
    vpc,
    lambdaLayers,
    inputQueue: linkPatientQueue,
    coverageConfig,
    alarmSnsAction,
  });

  return {
    sessionLambda,
    linkPatientQueue,
    linkPatientsLambda,
  };
}

function setupCredsStore(secrets: Secrets): secret.ISecret | undefined {
  // const config = getConfig();
  // A bit of gymnastic to get a compilation error if we change the name of the env var
  // TODO 1195 Either remove or re-enable this and finish building it
  // const envVarName: Extract<keyof typeof config.cwSecretNames, "CW_MANAGEMENT_CREDS"> =
  //     "CW_MANAGEMENT_CREDS";
  const envVarName = "not-available";
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
     * Initialize w/ an empty JSON so it can be parsed by the lambda.
     *
     * From the SDK: Do not use this method for any secrets that you care about!
     * The value will be visible to anyone who has access to the CloudFormation template
     * (via the AWS Console, SDKs, or CLI).
     */
    secretStringValue: SecretValue.unsafePlainText(JSON.stringify([])),
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
  coverageConfig,
  credsStore,
  cookieStore,
  codeChallengeStore,
  bucket,
  alarmSnsAction,
}: {
  stack: Construct;
  vpc: IVpc;
  lambdaLayers: ILayerVersion[];
  coverageConfig: CWCoverageEnhancementConfig;
  credsStore: secret.ISecret;
  cookieStore: secret.Secret;
  codeChallengeStore: secret.Secret;
  bucket: IBucket;
  alarmSnsAction?: SnsAction;
}): IFunction {
  const config = getConfig();
  const cwBaseUrl = coverageConfig.managementUrl;
  const notificationUrl = coverageConfig.codeChallengeNotificationUrl;

  const {
    connectorName,
    sessionManagementLambda: { memory, timeout, scheduleExpression },
  } = settings();
  const lambda = createScheduledLambda({
    stack,
    name: connectorName + "SessionMgmt",
    scheduleExpression,
    vpc,
    subnets: vpc.privateSubnets,
    entry: "cw-session-management",
    layers: lambdaLayers,
    memory,
    envType: config.environmentType,
    envVars: {
      COOKIE_SECRET_ARN: cookieStore.secretArn,
      CODE_CHALLENGE_SECRET_ARN: codeChallengeStore.secretArn,
      CODE_CHALLENGE_NOTIF_URL: notificationUrl,
      CW_MGMT_CREDS_SECRET_NAME: credsStore.secretName,
      CW_MGMT_URL: cwBaseUrl,
      ERROR_BUCKET_NAME: bucket.bucketName,
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

  bucket.grantReadWrite(lambda);

  return lambda;
}

// function createPatientsGroupingQueue(stack: Construct, lambdaLayers: ILayerVersion[]): sqs.IQueue {
//   const {
//     connectorName,
//     sqsPatientsGrouping: { receiveMessageWaitTime, maxReceiveCount, visibilityTimeout },
//   } = settings();
//   const name = connectorName + "PatientsGrouping";
//   return createQueue({
//     stack,
//     name,
//     fifo: true,
//     createDLQ: true,
//     createRetryLambda: true,
//     lambdaLayers,
//     contentBasedDeduplication: false, // TODO 1195 gotta set deduplication ID in SendMessage()
//     receiveMessageWaitTime,
//     maxReceiveCount,
//     visibilityTimeout,
//   });
// }

function createLinkPatientQueue(
  stack: Construct,
  lambdaLayers: LambdaLayers,
  envType: EnvType
): sqs.IQueue {
  const {
    connectorName,
    sqsLinkPatients: { receiveMessageWaitTime, maxReceiveCount, visibilityTimeout },
  } = settings();
  const name = connectorName + "LinkPatient";
  return createQueue({
    stack,
    name,
    fifo: true,
    createDLQ: true,
    createRetryLambda: true,
    lambdaLayers: [lambdaLayers.shared],
    envType,
    contentBasedDeduplication: false, // gotta set deduplication ID in SendMessage()
    receiveMessageWaitTime,
    maxReceiveCount,
    visibilityTimeout,
  });
}

function createLinkPatientsLambda({
  stack,
  vpc,
  lambdaLayers,
  inputQueue,
  coverageConfig,
  alarmSnsAction,
}: {
  stack: Construct;
  vpc: IVpc;
  lambdaLayers: LambdaLayers;
  inputQueue: sqs.IQueue;
  coverageConfig: CWCoverageEnhancementConfig;
  alarmSnsAction?: SnsAction;
}): IFunction {
  const config = getConfig();
  const {
    connectorName,
    linkPatientsLambda: { memory, batchSize, reportBatchItemFailures, timeout },
  } = settings();
  const name = connectorName + "LinkPatients";

  const lambda = createLambda({
    stack,
    name,
    vpc,
    subnets: vpc.privateSubnets,
    entry: "cw-link-patients",
    layers: [lambdaLayers.shared],
    memory,
    envType: config.environmentType,
    envVars: {
      ...(config.lambdasSentryDSN ? { SENTRY_DSN: config.lambdasSentryDSN } : {}),
      INPUT_QUEUE_URL: inputQueue.queueUrl,
      CW_MANAGEMENT_URL: coverageConfig.managementUrl,
    },
    timeout,
    alarmSnsAction,
  });

  lambda.addEventSource(
    new SqsEventSource(inputQueue, {
      batchSize,
      reportBatchItemFailures,
      enabled: true,
    })
  );

  provideAccessToQueue({ accessType: "both", queue: inputQueue, resource: lambda });

  return lambda;
}

// function createPatientsGroupingLambda({
//   stack,
//   vpc,
//   lambdaLayers,
//   outputQueue,
//   coverageConfig,
//   bucket,
//   alarmSnsAction,
// }: {
//   stack: Construct;
//   vpc: IVpc;
//   lambdaLayers: ILayerVersion[];
//   outputQueue: sqs.IQueue;
//   coverageConfig: CWCoverageEnhancementConfig;
//   bucket: IBucket;
//   alarmSnsAction?: SnsAction;
// }): IFunction {
//   const config = getConfig();
//   const {
//     connectorName,
//     patientsGroupingLambda: { memory, scheduleExpression, timeout },
//   } = settings();
//   const name = connectorName + "PatientsGrouping";

//   const lambda = createScheduledLambda({
//     stack,
//     vpc,
//     name,
//     scheduleExpression,
//     subnets: vpc.privateSubnets,
//     entry: "cw-patients-grouping",
//     layers: lambdaLayers,
//     memory,
//     envVars: {
//       ENV_TYPE: config.environmentType,
//       ...(config.lambdasSentryDSN ? { SENTRY_DSN: config.lambdasSentryDSN } : {}),
//       OUTPUT_QUEUE_URL: outputQueue.queueUrl,
//       ORG_LIST_S3_BUCKET: bucket.bucketName,
//       ORG_LISTS_S3_KEY: coverageConfig.orgListS3Key,
//     },
//     timeout,
//     alarmSnsAction,
//   });

//   provideAccessToQueue({ accessType: "send", queue: outputQueue, resource: lambda });

//   return lambda;
// }
