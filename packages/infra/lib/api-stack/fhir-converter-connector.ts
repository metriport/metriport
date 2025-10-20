import { Duration } from "aws-cdk-lib";
import { SnsAction } from "aws-cdk-lib/aws-cloudwatch-actions";
import * as dynamodb from "aws-cdk-lib/aws-dynamodb";
import { IVpc } from "aws-cdk-lib/aws-ec2";
import { Function as Lambda } from "aws-cdk-lib/aws-lambda";
import { SqsEventSource } from "aws-cdk-lib/aws-lambda-event-sources";
import * as s3 from "aws-cdk-lib/aws-s3";
import { IQueue } from "aws-cdk-lib/aws-sqs";
import { Construct } from "constructs";
import { EnvConfig } from "../../config/env-config";
import { EnvType } from "../env-type";
import { getConfig } from "../shared/config";
import { createLambda as defaultCreateLambda } from "../shared/lambda";
import { LambdaLayers } from "../shared/lambda-layers";
import { createQueue as defaultCreateQueue, provideAccessToQueue } from "../shared/sqs";
import { settings as settingsFhirConverter } from "./fhir-converter-service";

export type FHIRConverterConnector = {
  queue: IQueue;
  dlq: IQueue;
  bucket: s3.IBucket;
  lambda: Lambda;
};

/**
 * Determines the ratio of lambdas to ECS cores. We want this lower than 1 to minimize sending more requests
 * than the FHIR Converter can process in parallel, which would mean using it's worker thread's internal queue.
 * See more here: https://metriport.slack.com/archives/C04DBBJSKGB/p1739719790818809?thread_ts=1739665734.719219&cid=C04DBBJSKGB
 */
const multiplier = 0.8;

function settings() {
  const {
    cpuAmount: fhirConverterCPUAmount,
    taskCountMin: fhirConverterTaskCountMin,
    maxExecutionTimeout,
  } = settingsFhirConverter();
  const lambdaTimeout = maxExecutionTimeout.minus(Duration.seconds(5));
  return {
    connectorName: "FHIRConverter",
    lambdaMemory: 2048,
    // Number of messages the lambda pull from SQS at once
    lambdaBatchSize: 1,
    // Max number of concurrent instances of the lambda that an Amazon SQS event source can invoke [2 - 1000].
    maxConcurrency: Math.max(
      2,
      Math.ceil(fhirConverterCPUAmount * fhirConverterTaskCountMin * multiplier)
    ),
    // How long can the lambda run for, max is 900 seconds (15 minutes)
    lambdaTimeout,
    // How long will it take before Axios returns a timeout error - should be less than the lambda timeout
    axiosTimeout: lambdaTimeout.minus(Duration.seconds(5)), // give the lambda some time to deal with the timeout
    // The number of times a message can be unsuccesfully dequeued before being moved to the dead-letter queue.
    maxReceiveCount: 1,
    // How long messages should be invisible for other consumers, based on the lambda timeout
    // We don't care if the message gets reprocessed, so no need to have a huge visibility timeout that makes it harder to move messages to the DLQ
    visibilityTimeout: Duration.seconds(lambdaTimeout.toSeconds() * 2 + 1),
    // How long a message can be on the queue before an alarm is triggered
    alarmMaxAgeOfOldestMessage: Duration.minutes(5),
    // How many messages to allow in the queue before an alarm is triggered
    maxMessageCountAlarmThreshold: 50_000,
  };
}

/**
 * Creates a FHIR Converter connector.
 *
 * It's receives messages to convert a CDA to a FHIR bundle in the SQS queue, which are then picked
 * up by the FHIR Converter lambda.
 *
 * The lambda puts the converted FHIR bundle in an S3 bucket and notifies the OSS API via an SQS
 * queue that a new document is ready to be processed.
 *
 * @param stack - The stack to create the connector in.
 * @param vpc - The VPC to create the connector in.
 * @param lambdaLayers - The lambda layers to use for the connector.
 * @param envType - The environment type to use for the connector.
 * @param alarmSnsAction - The SNS action to use for the connector.
 * @param config - The config to use for the connector.
 * @param medicalDocumentsBucket - The medical documents bucket to use for the connector.
 * @param featureFlagsTable - The feature flags table to use for the connector.
 * @param apiNotifierQueue - The API notifier queue to use for the connector.
 *
 * @returns The FHIR Converter connector.
 */
export function create({
  stack,
  vpc,
  lambdaLayers,
  envType,
  alarmSnsAction,
  config,
  medicalDocumentsBucket,
  featureFlagsTable,
  apiNotifierQueue,
}: {
  stack: Construct;
  vpc: IVpc;
  lambdaLayers: LambdaLayers;
  envType: EnvType;
  alarmSnsAction?: SnsAction;
  config: EnvConfig;
  medicalDocumentsBucket: s3.IBucket;
  featureFlagsTable: dynamodb.Table;
  apiNotifierQueue: IQueue;
}): FHIRConverterConnector {
  const { queue, dlq, bucket } = createQueueAndBucket({
    stack,
    envType,
    alarmSnsAction,
  });
  const fhirConverterLambda = createLambda({
    envType,
    stack,
    lambdaLayers,
    vpc,
    sourceQueue: queue,
    dlq,
    fhirConverterBucket: bucket,
    medicalDocumentsBucket,
    fhirServerUrl: config.fhirServerUrl,
    termServerUrl: config.termServerUrl,
    alarmSnsAction,
    featureFlagsTable,
    apiNotifierQueue,
  });
  return {
    queue,
    dlq,
    bucket,
    lambda: fhirConverterLambda,
  };
}

export function createQueueAndBucket({
  stack,
  envType,
  alarmSnsAction,
}: {
  stack: Construct;
  envType: EnvType;
  alarmSnsAction?: SnsAction;
}): Omit<FHIRConverterConnector, "lambda"> {
  const config = getConfig();
  const {
    connectorName,
    visibilityTimeout,
    maxReceiveCount,
    maxMessageCountAlarmThreshold,
    alarmMaxAgeOfOldestMessage,
  } = settings();
  const queue = defaultCreateQueue({
    stack,
    name: connectorName,
    // To use FIFO we'd need to change the lambda code to set visibilityTimeout=0 on messages to be
    // reprocessed, instead of re-enqueueing them (bc of messageDeduplicationId visibility of 5min)
    fifo: false,
    visibilityTimeout,
    maxReceiveCount,
    envType,
    alarmSnsAction,
    alarmMaxAgeOfOldestMessage,
    maxMessageCountAlarmThreshold,
  });

  const dlq = queue.deadLetterQueue;
  if (!dlq) throw Error(`Missing DLQ of Queue ${queue.queueName}`);

  const bucketName = config.fhirConverterBucketName;
  const existingBucket = bucketName
    ? s3.Bucket.fromBucketName(stack, `${connectorName}Bucket`, bucketName)
    : undefined;
  const fhirConverterBucket =
    existingBucket ??
    new s3.Bucket(stack, `${connectorName}Bucket`, {
      bucketName: config.fhirConverterBucketName,
      publicReadAccess: false,
      encryption: s3.BucketEncryption.S3_MANAGED,
    });

  return { queue, dlq: dlq.queue, bucket: fhirConverterBucket };
}

export function createLambda({
  lambdaLayers,
  envType,
  stack,
  vpc,
  sourceQueue,
  dlq,
  fhirConverterBucket,
  medicalDocumentsBucket,
  fhirServerUrl,
  termServerUrl,
  alarmSnsAction,
  featureFlagsTable,
  apiNotifierQueue,
}: {
  lambdaLayers: LambdaLayers;
  envType: EnvType;
  stack: Construct;
  vpc: IVpc;
  sourceQueue: IQueue;
  dlq: IQueue;
  fhirConverterBucket: s3.IBucket;
  medicalDocumentsBucket: s3.IBucket;
  fhirServerUrl: string;
  termServerUrl?: string;
  alarmSnsAction?: SnsAction;
  featureFlagsTable: dynamodb.Table;
  apiNotifierQueue: IQueue;
}): Lambda {
  const config = getConfig();
  const {
    connectorName,
    lambdaMemory,
    lambdaTimeout,
    lambdaBatchSize,
    maxConcurrency,
    axiosTimeout,
  } = settings();
  const conversionLambda = defaultCreateLambda({
    stack,
    name: connectorName,
    vpc,
    subnets: vpc.privateSubnets,
    entry: "sqs-to-converter",
    layers: [lambdaLayers.shared],
    memory: lambdaMemory,
    envType,
    envVars: {
      AXIOS_TIMEOUT_SECONDS: axiosTimeout.toSeconds().toString(),
      ...(config.lambdasSentryDSN ? { SENTRY_DSN: config.lambdasSentryDSN } : {}),
      FHIR_SERVER_URL: fhirServerUrl,
      ...(termServerUrl && { TERM_SERVER_URL: termServerUrl }),
      MEDICAL_DOCUMENTS_BUCKET_NAME: medicalDocumentsBucket.bucketName,
      QUEUE_URL: sourceQueue.queueUrl,
      DLQ_URL: dlq.queueUrl,
      CONVERSION_RESULT_BUCKET_NAME: fhirConverterBucket.bucketName,
      CONVERSION_RESULT_QUEUE_URL: apiNotifierQueue.queueUrl,
      FEATURE_FLAGS_TABLE_NAME: featureFlagsTable.tableName,
    },
    timeout: lambdaTimeout,
    alarmSnsAction,
  });

  fhirConverterBucket.grantReadWrite(conversionLambda);
  medicalDocumentsBucket.grantReadWrite(conversionLambda);
  featureFlagsTable.grantReadData(conversionLambda);

  conversionLambda.addEventSource(
    new SqsEventSource(sourceQueue, {
      batchSize: lambdaBatchSize,
      // Partial batch response: https://docs.aws.amazon.com/prescriptive-guidance/latest/lambda-event-filtering-partial-batch-responses-for-sqs/welcome.html
      reportBatchItemFailures: true,
      maxConcurrency,
    })
  );
  provideAccessToQueue({ accessType: "both", queue: sourceQueue, resource: conversionLambda });
  provideAccessToQueue({ accessType: "send", queue: dlq, resource: conversionLambda });
  provideAccessToQueue({ accessType: "send", queue: apiNotifierQueue, resource: conversionLambda });
  return conversionLambda;
}
