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
import { LambdaLayers } from "../shared/lambda-layers";
import { createQueue as defaultCreateQueue, provideAccessToQueue } from "../shared/sqs";
import { isProd } from "../shared/util";

function settings() {
  const config = getConfig();
  const prod = isProd(config);
  // How long can the lambda run for, max is 900 seconds (15 minutes)
  // It SHOULD be slightly less than the ALB timeout of the FHIR server
  const lambdaTimeout = Duration.minutes(15).minus(Duration.seconds(30)); // https://github.com/metriport/metriport-internal/issues/740
  return {
    connectorName: "FHIRServer",
    lambdaMemory: 1024,
    // Number of messages the lambda pull from SQS at once
    lambdaBatchSize: 1,
    // Max number of concurrent instances of the lambda that an Amazon SQS event source can invoke [2 - 1000].
    maxConcurrency: prod ? 32 : 4,
    // How long can the lambda run for, max is 900 seconds (15 minutes)
    lambdaTimeout,
    // Number of times we want to retry a message, this includes throttles!
    maxReceiveCount: 5,
    // Number of times we want to retry a message that timed out when trying to be processed
    maxTimeoutRetries: 15,
    // How long messages should be invisible for other consumers, based on the lambda timeout
    // We don't care if the message gets reprocessed, so no need to have a huge visibility timeout that makes it harder to move messages to the DLQ
    visibilityTimeout: Duration.seconds(lambdaTimeout.toSeconds() * 2 + 1),
    delayWhenRetrying: Duration.seconds(10),
  };
}

export function createConnector({
  envType,
  stack,
  vpc,
  fhirConverterBucket,
  lambdaLayers,
  alarmSnsAction,
}: {
  envType: EnvType;
  stack: Construct;
  vpc: IVpc;
  fhirConverterBucket: s3.IBucket;
  lambdaLayers: LambdaLayers;
  alarmSnsAction?: SnsAction;
}): Queue | undefined {
  const config = getConfig();
  const fhirServerUrl = config.fhirServerUrl;
  if (!fhirServerUrl) {
    console.log("No FHIR Server URL provided, skipping connector creation");
    return undefined;
  }
  const apiURL = config.loadBalancerDnsName;
  if (!apiURL) {
    console.log("No API URL provided, skipping connector creation");
    return undefined;
  }
  const {
    connectorName,
    lambdaMemory,
    lambdaTimeout,
    lambdaBatchSize,
    maxConcurrency,
    maxReceiveCount,
    visibilityTimeout,
    maxTimeoutRetries,
    delayWhenRetrying,
  } = settings();
  const queue = defaultCreateQueue({
    stack,
    name: connectorName,
    // To use FIFO we'd need to change the lambda code to set visibilityTimeout=0 on messages to be
    // reprocessed, instead of re-enqueueing them (bc of messageDeduplicationId visibility of 5min)
    fifo: false,
    visibilityTimeout,
    maxReceiveCount,
    lambdaLayers: [lambdaLayers.shared],
    envType,
    alarmSnsAction,
  });

  const dlq = queue.deadLetterQueue;
  if (!dlq) throw Error(`Missing DLQ of Queue ${queue.queueName}`);

  const sqsToFhirLambda = defaultCreateLambda({
    stack,
    name: connectorName,
    vpc,
    subnets: vpc.privateSubnets,
    entry: "sqs-to-fhir",
    layers: [lambdaLayers.shared],
    memory: lambdaMemory,
    envType,
    envVars: {
      METRICS_NAMESPACE,
      MAX_TIMEOUT_RETRIES: String(maxTimeoutRetries),
      DELAY_WHEN_RETRY_SECONDS: delayWhenRetrying.toSeconds().toString(),
      ...(config.lambdasSentryDSN ? { SENTRY_DSN: config.lambdasSentryDSN } : {}),
      QUEUE_URL: queue.queueUrl,
      DLQ_URL: dlq.queue.queueUrl,
      FHIR_SERVER_URL: fhirServerUrl,
      API_URL: apiURL,
    },
    timeout: lambdaTimeout,
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
