import { Duration } from "aws-cdk-lib";
import { SnsAction } from "aws-cdk-lib/aws-cloudwatch-actions";
import * as dynamodb from "aws-cdk-lib/aws-dynamodb";
import { IVpc } from "aws-cdk-lib/aws-ec2";
import { Function as Lambda, Runtime } from "aws-cdk-lib/aws-lambda";
import { SqsEventSource } from "aws-cdk-lib/aws-lambda-event-sources";
import * as s3 from "aws-cdk-lib/aws-s3";
import { IQueue } from "aws-cdk-lib/aws-sqs";
import { Construct } from "constructs";
import { EnvType } from "../env-type";
import { METRICS_NAMESPACE, getConfig } from "../shared/config";
import { MAXIMUM_LAMBDA_TIMEOUT, createLambda as defaultCreateLambda } from "../shared/lambda";
import { LambdaLayers } from "../shared/lambda-layers";
import { createQueue as defaultCreateQueue, provideAccessToQueue } from "../shared/sqs";
import { FHIRConnector } from "./fhir-converter-connector";

function settings() {
  const lambdaTimeout = MAXIMUM_LAMBDA_TIMEOUT.minus(Duration.seconds(5));
  return {
    connectorName: "SidechainFHIRConverter",
    lambdaMemory: 1024,
    // Number of messages the lambda pull from SQS at once
    lambdaBatchSize: 1,
    // Max number of concurrent instances of the lambda that an Amazon SQS event source can invoke [2 - 1000].
    maxConcurrency: 5,
    // How long can the lambda run for, max is 900 seconds (15 minutes)
    lambdaTimeout,
    // How long will it take before Axios returns a timeout error - should be less than the lambda timeout
    axiosTimeout: lambdaTimeout.minus(Duration.seconds(5)), // give the lambda some time to deal with the timeout
    // Number of times we want to retry a message, this includes throttles!
    maxReceiveCount: 5,
    // Number of times we want to retry a message that timed out when trying to be processed
    maxTimeoutRetries: 99,
    // How long messages should be invisible for other consumers, based on the lambda timeout
    // We don't care if the message gets reprocessed, so no need to have a huge visibility timeout that makes it harder to move messages to the DLQ
    visibilityTimeout: Duration.seconds(lambdaTimeout.toSeconds() * 2 + 1),
    delayWhenRetrying: Duration.seconds(10),
  };
}

export function createQueueAndBucket({
  stack,
  lambdaLayers,
  envType,
  alarmSnsAction,
}: {
  stack: Construct;
  lambdaLayers: LambdaLayers;
  envType: EnvType;
  alarmSnsAction?: SnsAction;
}): FHIRConnector {
  const config = getConfig();
  const { connectorName, visibilityTimeout, maxReceiveCount } = settings();
  const queue = defaultCreateQueue({
    stack,
    name: connectorName,
    lambdaLayers: [lambdaLayers.shared],
    envType,
    // To use FIFO we'd need to change the lambda code to set visibilityTimeout=0 on messages to be
    // reprocessed, instead of re-enqueueing them (bc of messageDeduplicationId visibility of 5min)
    fifo: false,
    visibilityTimeout,
    maxReceiveCount,
    alarmSnsAction,
  });

  const dlq = queue.deadLetterQueue;
  if (!dlq) throw Error(`Missing DLQ of Queue ${queue.queueName}`);

  const bucketName = config.sidechainFHIRConverter?.bucketName;
  if (!bucketName) throw Error(`Missing config! Path: config.sidechainFHIRConverter.bucketName`);

  const existingBucket = s3.Bucket.fromBucketName(stack, `${connectorName}Bucket`, bucketName);
  const fhirConverterBucket =
    existingBucket ??
    new s3.Bucket(stack, `${connectorName}Bucket`, {
      bucketName: bucketName,
      publicReadAccess: false,
      encryption: s3.BucketEncryption.S3_MANAGED,
    });

  return { queue, dlq: dlq.queue, bucket: fhirConverterBucket };
}

export function createLambda({
  envType,
  stack,
  lambdaLayers,
  vpc,
  sourceQueue,
  destinationQueue,
  dlq,
  fhirConverterBucket,
  apiServiceDnsAddress,
  alarmSnsAction,
  dynamoDBSidechainKeysTable,
}: {
  envType: EnvType;
  stack: Construct;
  lambdaLayers: LambdaLayers;
  vpc: IVpc;
  sourceQueue: IQueue;
  destinationQueue: IQueue;
  dlq: IQueue;
  fhirConverterBucket: s3.IBucket;
  apiServiceDnsAddress: string;
  alarmSnsAction?: SnsAction;
  dynamoDBSidechainKeysTable: dynamodb.Table | undefined;
}): Lambda {
  const config = getConfig();
  const {
    connectorName,
    lambdaMemory,
    lambdaTimeout,
    lambdaBatchSize,
    maxConcurrency,
    axiosTimeout,
    maxTimeoutRetries,
    delayWhenRetrying,
  } = settings();

  if (!config.sidechainFHIRConverter)
    throw Error(`Missing config! Path: config.sidechainFHIRConverter`);
  const sidechainFHIRConverterUrl = config.sidechainFHIRConverter.url;
  const sidechainUrlBlacklist = config.sidechainFHIRConverter.urlBlacklist;
  const sidechainWordsToRemove = config.sidechainFHIRConverter.wordsToRemove;

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
      METRICS_NAMESPACE,
      AXIOS_TIMEOUT_SECONDS: axiosTimeout.toSeconds().toString(),
      MAX_TIMEOUT_RETRIES: String(maxTimeoutRetries),
      DELAY_WHEN_RETRY_SECONDS: delayWhenRetrying.toSeconds().toString(),
      ...(config.lambdasSentryDSN ? { SENTRY_DSN: config.lambdasSentryDSN } : {}),
      API_URL: `http://${apiServiceDnsAddress}`,
      QUEUE_URL: sourceQueue.queueUrl,
      DLQ_URL: dlq.queueUrl,
      CONVERSION_RESULT_QUEUE_URL: destinationQueue.queueUrl,
      CONVERSION_RESULT_BUCKET_NAME: fhirConverterBucket.bucketName,
      SIDECHAIN_FHIR_CONVERTER_URL: sidechainFHIRConverterUrl,
      SIDECHAIN_FHIR_CONVERTER_URL_BLACKLIST: sidechainUrlBlacklist,
      SIDECHAIN_FHIR_CONVERTER_WORDS_TO_REMOVE: sidechainWordsToRemove,
      SIDECHAIN_FHIR_CONVERTER_KEYS_TABLE_NAME: dynamoDBSidechainKeysTable?.tableName ?? "",
    },
    timeout: lambdaTimeout,
    alarmSnsAction,
    runtime: Runtime.NODEJS_18_X,
  });

  fhirConverterBucket.grantReadWrite(conversionLambda);
  if (dynamoDBSidechainKeysTable) {
    dynamoDBSidechainKeysTable.grantReadWriteData(conversionLambda);
  }

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
  provideAccessToQueue({ accessType: "send", queue: destinationQueue, resource: conversionLambda });

  return conversionLambda;
}
