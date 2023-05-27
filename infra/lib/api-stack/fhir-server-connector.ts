import { Duration } from "aws-cdk-lib";
import { SnsAction } from "aws-cdk-lib/aws-cloudwatch-actions";
import { IVpc } from "aws-cdk-lib/aws-ec2";
import { SqsEventSource } from "aws-cdk-lib/aws-lambda-event-sources";
import * as s3 from "aws-cdk-lib/aws-s3";
import { Queue } from "aws-cdk-lib/aws-sqs";
import { Construct } from "constructs";
import { EnvType } from "../env-type";
import { getConfig, METRICS_NAMESPACE } from "../shared/config";
import { createLambda as defaultCreateLambda } from "../shared/lambda";
import { createQueue as defaultCreateQueue, provideAccessToQueue } from "../shared/sqs";

const connectorName = "FHIRServer";
const lambdaMemory = 256;
// Number of messages the lambda pull from SQS at once
const lambdaBatchSize = 1;
// Max number of concurrent instances of the lambda that an Amazon SQS event source can invoke [2 - 1000].
const maxConcurrency = 4;
// How long can the lambda run for, max is 900 seconds (15 minutes)
const lambdaTimeoutSeconds = 14 * 60;
// Number of times we want to retry a message, this includes throttles!
const maxReceiveCount = 5;
// Number of times we want to retry a message that timed out when trying to be processed
const maxTimeoutRetries = 99;
// How long messages should be invisible for other consumers, based on the lambda timeout
const visibilityTimeoutMultiplier = 6;
const delayWhenRetryingSeconds = 10;

export function createConnector({
  envType,
  stack,
  vpc,
  fhirConverterBucket,
  alarmSnsAction,
}: {
  envType: EnvType;
  stack: Construct;
  vpc: IVpc;
  fhirConverterBucket: s3.Bucket;
  alarmSnsAction?: SnsAction;
}): Queue | undefined {
  const config = getConfig();
  const fhirServerUrl = config.fhirServerUrl;
  if (!fhirServerUrl) {
    console.log("No FHIR Server URL provided, skipping connector creation");
    return undefined;
  }
  const queue = defaultCreateQueue({
    stack,
    name: connectorName,
    vpc,
    // To use FIFO we'd need to change the lambda code to set visibilityTimeout=0 on messages to be
    // reprocessed, instead of re-enqueueing them (bc of messageDeduplicationId visibility of 5min)
    fifo: false,
    // We don't care if the message gets reprocessed, so no need to have a huge visibility timeout
    // that makes it harder to move messages to the DLQ
    visibilityTimeout: Duration.seconds(visibilityTimeoutMultiplier * lambdaTimeoutSeconds + 1),
    maxReceiveCount,
  });

  const dlq = queue.deadLetterQueue;
  if (!dlq) throw Error(`Missing DLQ of Queue ${queue.queueName}`);

  const sqsToFhirLambda = defaultCreateLambda({
    stack,
    name: connectorName,
    vpc,
    subnets: vpc.privateSubnets,
    entry: "../api/lambdas/sqs-to-fhir/index.js",
    memory: lambdaMemory,
    envVars: {
      METRICS_NAMESPACE,
      ENV_TYPE: envType,
      MAX_TIMEOUT_RETRIES: String(maxTimeoutRetries),
      DELAY_WHEN_RETRY: String(delayWhenRetryingSeconds),
      ...(config.lambdasSentryDSN ? { SENTRY_DSN: config.lambdasSentryDSN } : {}),
      QUEUE_URL: queue.queueUrl,
      DLQ_URL: dlq.queue.queueUrl,
      ...(fhirServerUrl && {
        FHIR_SERVER_URL: config.fhirServerUrl,
      }),
    },
    timeout: Duration.seconds(lambdaTimeoutSeconds),
    alarmSnsAction,
  });

  fhirConverterBucket.grantRead(sqsToFhirLambda);
  sqsToFhirLambda.addEventSource(
    new SqsEventSource(queue, {
      batchSize: lambdaBatchSize,
      // Partial batch response: https://docs.aws.amazon.com/prescriptive-guidance/latest/lambda-event-filtering-partial-batch-responses-for-sqs/welcome.html
      reportBatchItemFailures: true,
      maxConcurrency,
    })
  );
  provideAccessToQueue({ accessType: "both", queue, resource: sqsToFhirLambda });
  provideAccessToQueue({ accessType: "send", queue: dlq.queue, resource: sqsToFhirLambda });

  return queue;
}
