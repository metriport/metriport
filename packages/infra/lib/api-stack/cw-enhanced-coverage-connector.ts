import { Duration, SecretValue } from "aws-cdk-lib";
import { SnsAction } from "aws-cdk-lib/aws-cloudwatch-actions";
import { IVpc } from "aws-cdk-lib/aws-ec2";
import { IFunction } from "aws-cdk-lib/aws-lambda";
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
import { isProd } from "../shared/util";

export type EnhancedCoverageConnectorProps = {
  stack: Construct;
  lambdaLayers: LambdaLayers;
  vpc: IVpc;
  apiAddress: string;
  envType: EnvType;
  secrets: Secrets;
  bucket: IBucket;
  alarmSnsAction?: SnsAction;
};

export function settings(props: EnhancedCoverageConnectorProps) {
  const config = getConfig();

  const triggerLambda = {
    /**
     * UTC-based: "Minutes Hours Day-of-month Month Day-of-week Year"
     * @see: https://docs.aws.amazon.com/eventbridge/latest/userguide/eb-cron-expressions.html
     * @see: https://docs.aws.amazon.com/lambda/latest/dg/services-cloudwatchevents-expressions.html
     */
    scheduleExpression: isProd(config)
      ? ["0/20 * ? * * *"] // Every 20min, every day
      : [],
    memory: 512,
    lambdaTimeout: Duration.minutes(2),
    httpTimeout: Duration.minutes(1),
    url: `http://${props.apiAddress}/internal/patient/enhance-coverage`,
  };

  // How long can the lambda run for, max is 900 seconds (15 minutes)
  const linkPatientsLambdaTimeout = Duration.minutes(5).minus(Duration.seconds(5));

  const linkPatientsLambda = {
    memory: 1024,
    batchSize: 1,
    reportBatchItemFailures: true,
    lambdaTimeout: linkPatientsLambdaTimeout,
    apiBaseUrl: `http://${props.apiAddress}`,
  };

  const linkPatientsQueue = {
    receiveMessageWaitTime: Duration.seconds(20),
    maxReceiveCount: 1,
    visibilityTimeout: Duration.seconds(linkPatientsLambdaTimeout.toSeconds() * 2 + 1),
  };

  return {
    connectorName: "CWEnhancedCoverage",
    triggerLambda,
    linkPatientsLambda,
    linkPatientsQueue,
  };
}

function getCoverageConfig(): CWCoverageEnhancementConfig | undefined {
  const config = getConfig();
  const coverageConfig = config.commonwell.coverageEnhancement;
  if (!coverageConfig) {
    console.log(`CW coverage enhancement is not enabled, skipping...`);
    return undefined;
  }
  return coverageConfig;
}

export function setupRequiredInfra(props: EnhancedCoverageConnectorProps):
  | {
      linkPatientsQueue: sqs.IQueue;
      cookieStore: secret.Secret;
    }
  | undefined {
  const coverageConfig = getCoverageConfig();
  if (!coverageConfig) return undefined;

  // queue to get the group of patients + CQ orgs
  const linkPatientsQueue = createLinkPatientQueue(props);

  const theSettings = settings(props);

  const cookieStore = createCookiesStore(props.stack, theSettings);
  createCodeChallengeStore(props.stack, theSettings);

  return {
    linkPatientsQueue,
    cookieStore,
  };
}

export function setupLambdas(
  props: EnhancedCoverageConnectorProps & {
    linkPatientsQueue: sqs.IQueue;
    cookieStore: secret.Secret;
  }
):
  | {
      linkPatientsLambda: IFunction;
    }
  | undefined {
  const coverageConfig = getCoverageConfig();
  if (!coverageConfig) return undefined;

  // scheduled lambda to trigger Enhanced Coverage
  createScheduledTriggerECLambda(props);

  // lambda link patients to CQ orgs
  const linkPatientsLambda = createLinkPatientsLambda({
    ...props,
    inputQueue: props.linkPatientsQueue,
    coverageConfig,
  });

  return { linkPatientsLambda };
}

function createCookiesStore(
  stack: Construct,
  theSettings: ReturnType<typeof settings>
): secret.Secret {
  const { connectorName } = theSettings;
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

function createCodeChallengeStore(
  stack: Construct,
  theSettings: ReturnType<typeof settings>
): secret.Secret {
  const { connectorName } = theSettings;
  const name = connectorName + "CodeChallengeSecret";
  // Not an actual secret that needs to be set prior to the deployment, this is more a
  // single value storage, that's why we're not creating it on the SecretsStack
  return new secret.Secret(stack, name, { secretName: name });
}

function createLinkPatientQueue(props: EnhancedCoverageConnectorProps): sqs.IQueue {
  const { stack } = props;
  const {
    connectorName,
    linkPatientsQueue: { receiveMessageWaitTime, maxReceiveCount, visibilityTimeout },
  } = settings(props);
  const name = connectorName + "LinkPatients";
  return createQueue({
    stack,
    name,
    fifo: true,
    createDLQ: false,
    createRetryLambda: false,
    contentBasedDeduplication: false, // gotta set deduplication ID in SendMessage()
    receiveMessageWaitTime,
    maxReceiveCount,
    visibilityTimeout,
  });
}

function createLinkPatientsLambda(
  props: EnhancedCoverageConnectorProps & {
    inputQueue: sqs.IQueue;
    coverageConfig: CWCoverageEnhancementConfig;
    cookieStore: secret.ISecret;
  }
): IFunction {
  const config = getConfig();
  const { stack, vpc, lambdaLayers, alarmSnsAction, inputQueue, coverageConfig, cookieStore } =
    props;
  const {
    connectorName,
    linkPatientsLambda: { memory, batchSize, reportBatchItemFailures, lambdaTimeout, apiBaseUrl },
  } = settings(props);
  const name = connectorName + "LinkPatients";

  const lambda = createLambda({
    stack,
    name,
    vpc,
    subnets: vpc.privateSubnets,
    entry: "cw-enhanced-coverage-link-patients",
    layers: [lambdaLayers.shared],
    memory,
    envType: config.environmentType,
    envVars: {
      ...(config.lambdasSentryDSN ? { SENTRY_DSN: config.lambdasSentryDSN } : {}),
      INPUT_QUEUE_URL: inputQueue.queueUrl,
      CW_MANAGEMENT_URL: coverageConfig.managementUrl,
      COOKIE_SECRET_ARN: cookieStore.secretArn,
      API_URL: apiBaseUrl,
    },
    timeout: lambdaTimeout,
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
  cookieStore.grantRead(lambda);

  return lambda;
}

function createScheduledTriggerECLambda(props: EnhancedCoverageConnectorProps): IFunction {
  const config = getConfig();
  const { stack, vpc, lambdaLayers, alarmSnsAction } = props;
  const {
    connectorName,
    triggerLambda: { memory, lambdaTimeout, scheduleExpression, url, httpTimeout },
  } = settings(props);

  const name = connectorName + "Trigger";

  const lambda = createScheduledLambda({
    stack,
    layers: [lambdaLayers.shared],
    name,
    vpc,
    scheduleExpression,
    url,
    memory,
    timeout: lambdaTimeout,
    alarmSnsAction,
    envType: config.environmentType,
    envVars: {
      TIMEOUT_MILLIS: String(httpTimeout.toMilliseconds()),
      ...(config.lambdasSentryDSN ? { SENTRY_DSN: config.lambdasSentryDSN } : {}),
    },
  });

  return lambda;
}
