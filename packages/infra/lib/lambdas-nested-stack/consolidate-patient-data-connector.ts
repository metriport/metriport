import { Duration } from "aws-cdk-lib";
import { SnsAction } from "aws-cdk-lib/aws-cloudwatch-actions";
import { IVpc } from "aws-cdk-lib/aws-ec2";
import { IFunction } from "aws-cdk-lib/aws-lambda";
import { SqsEventSource } from "aws-cdk-lib/aws-lambda-event-sources";
import * as s3 from "aws-cdk-lib/aws-s3";
import { IQueue } from "aws-cdk-lib/aws-sqs";
import { Construct } from "constructs";
import { EnvType } from "../env-type";
import { getConfig, METRICS_NAMESPACE } from "../shared/config";
import { createLambda as defaultCreateLambda } from "../shared/lambda";
import { LambdaLayers } from "../shared/lambda-layers";
import { createQueue as defaultCreateQueue, provideAccessToQueue } from "../shared/sqs";

function settings() {
  // How long can the lambda run for, max is 900 seconds (15 minutes)
  // It SHOULD be slightly less than the ALB timeout of the FHIR server
  const lambdaTimeout = Duration.minutes(5); // https://github.com/metriport/metriport-internal/issues/740
  return {
    connectorName: "PatientDataConsolidator",
    lambdaMemory: 2048,
    // Number of messages the lambda pull from SQS at once
    lambdaBatchSize: 1,
    // How long can the lambda run for, max is 900 seconds (15 minutes)
    lambdaTimeout,
    // Number of times we want to retry a message, this includes throttles!
    maxReceiveCount: 3,
    // How long messages should be invisible for other consumers, based on the lambda timeout
    // We don't care if the message gets reprocessed, so no need to have a huge visibility timeout that makes it harder to move messages to the DLQ
    visibilityTimeout: Duration.seconds(lambdaTimeout.toSeconds() * 2 + 1),
    retryAttempts: 2,
    maxMessageCountAlarmThreshold: 1_000,
    maxAgeOfOldestMessage: Duration.minutes(lambdaTimeout.toMinutes() * 2),
    maxAgeOfOldestMessageDlq: Duration.minutes(30),
  };
}

export type PatientDataConsolidatorConnector = {
  lambda: IFunction;
  queue: IQueue;
};

export function createConnector({
  envType,
  stack,
  vpc,
  patientConsolidatedDataBucket,
  sourceBucket,
  lambdaLayers,
  alarmSnsAction,
}: {
  envType: EnvType;
  stack: Construct;
  vpc: IVpc;
  patientConsolidatedDataBucket: s3.IBucket;
  sourceBucket: s3.IBucket;
  lambdaLayers: LambdaLayers;
  alarmSnsAction?: SnsAction;
}): PatientDataConsolidatorConnector {
  const config = getConfig();
  const {
    connectorName,
    lambdaMemory,
    lambdaTimeout,
    lambdaBatchSize,
    maxReceiveCount,
    visibilityTimeout,
    retryAttempts,
    maxAgeOfOldestMessage,
    maxAgeOfOldestMessageDlq,
    maxMessageCountAlarmThreshold,
  } = settings();

  const queue = defaultCreateQueue({
    stack,
    name: connectorName,
    // To use FIFO we'd need to change the lambda code to set visibilityTimeout=0 on messages to be
    // reprocessed, instead of re-enqueueing them (bc of messageDeduplicationId visibility of 5min)
    fifo: true,
    visibilityTimeout,
    maxReceiveCount,
    lambdaLayers: [lambdaLayers.shared],
    envType,
    alarmSnsAction,
    maxMessageCountAlarmThreshold,
    alarmMaxAgeOfOldestMessage: maxAgeOfOldestMessage,
    createDLQ: true,
    alarmMaxAgeOfOldestMessageDlq: maxAgeOfOldestMessageDlq,
  });

  const dlq = queue.deadLetterQueue;
  if (!dlq) throw Error(`Missing DLQ of Queue ${queue.queueName}`);

  const lambda = defaultCreateLambda({
    stack,
    name: connectorName,
    vpc,
    subnets: vpc.privateSubnets,
    entry: "sqs-to-consolidated",
    layers: [lambdaLayers.shared],
    memory: lambdaMemory,
    envType,
    retryAttempts,
    envVars: {
      METRICS_NAMESPACE,
      ...(config.lambdasSentryDSN ? { SENTRY_DSN: config.lambdasSentryDSN } : {}),
      CONSOLIDATED_PATIENT_DATA_BUCKET_NAME: patientConsolidatedDataBucket.bucketName,
      MEDICAL_DOCUMENTS_BUCKET_NAME: patientConsolidatedDataBucket.bucketName,
      CONVERSION_RESULT_BUCKET_NAME: sourceBucket.bucketName,
    },
    timeout: lambdaTimeout,
    alarmSnsAction,
  });

  patientConsolidatedDataBucket.grantRead(lambda);
  patientConsolidatedDataBucket.grantWrite(lambda);
  sourceBucket.grantRead(lambda);

  lambda.addEventSource(
    new SqsEventSource(queue, {
      batchSize: lambdaBatchSize,
      // Partial batch response: https://docs.aws.amazon.com/prescriptive-guidance/latest/lambda-event-filtering-partial-batch-responses-for-sqs/welcome.html
      reportBatchItemFailures: true,
    })
  );
  provideAccessToQueue({ accessType: "both", queue, resource: lambda });
  provideAccessToQueue({ accessType: "send", queue: dlq.queue, resource: lambda });

  return { lambda, queue };
}
