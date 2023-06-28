import { Duration } from "aws-cdk-lib";
import { SnsAction } from "aws-cdk-lib/aws-cloudwatch-actions";
import { IVpc } from "aws-cdk-lib/aws-ec2";
import { IGrantable } from "aws-cdk-lib/aws-iam";
import { Function as Lambda, ILayerVersion, Runtime } from "aws-cdk-lib/aws-lambda";
import { SqsEventSource } from "aws-cdk-lib/aws-lambda-event-sources";
import * as s3 from "aws-cdk-lib/aws-s3";
import { IQueue } from "aws-cdk-lib/aws-sqs";
import { Construct } from "constructs";
import { EnvType } from "../env-type";
import { FHIRConnector } from "../fhir-connector-stack";
import { getConfig, METRICS_NAMESPACE } from "../shared/config";
import {
  createLambda as defaultCreateLambda,
  createRetryLambda as defaultCreateRetryLambda,
  MAXIMUM_LAMBDA_TIMEOUT,
} from "../shared/lambda";
import { buildSecrets, Secrets } from "../shared/secrets";
import { createQueue as defaultCreateQueue, provideAccessToQueue } from "../shared/sqs";

function settings() {
  const lambdaTimeout = MAXIMUM_LAMBDA_TIMEOUT.minus(Duration.seconds(5));
  return {
    connectorName: "SidechainFHIRConverter",
    lambdaMemory: 512,
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
  alarmSnsAction,
}: {
  stack: Construct;
  alarmSnsAction?: SnsAction;
}): FHIRConnector {
  const config = getConfig();
  const { connectorName, visibilityTimeout, maxReceiveCount } = settings();
  const { queue, createRetryLambda } = defaultCreateQueue({
    stack,
    name: connectorName + "Queue",
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

  return { queue, dlq: dlq.queue, bucket: fhirConverterBucket, createRetryLambda };
}

export function createLambda({
  envType,
  stack,
  sharedNodeModules,
  vpc,
  sourceQueue,
  destinationQueue,
  dlq,
  createRetryLambda,
  fhirConverterBucket,
  apiTaskRole,
  apiServiceDnsAddress,
  medicalDocumentsBucket,
  alarmSnsAction,
}: {
  envType: EnvType;
  stack: Construct;
  sharedNodeModules: ILayerVersion;
  vpc: IVpc;
  sourceQueue: IQueue;
  destinationQueue: IQueue;
  dlq: IQueue;
  createRetryLambda?: boolean;
  fhirConverterBucket: s3.IBucket;
  apiTaskRole: IGrantable;
  apiServiceDnsAddress: string;
  medicalDocumentsBucket: s3.IBucket | undefined;
  alarmSnsAction?: SnsAction;
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
    name: connectorName + "Lambda",
    vpc,
    subnets: vpc.privateSubnets,
    entry: "sqs-to-converter",
    layers: [sharedNodeModules],
    memory: lambdaMemory,
    envVars: {
      METRICS_NAMESPACE,
      ENV_TYPE: envType,
      AXIOS_TIMEOUT_SECONDS: axiosTimeout.toSeconds().toString(),
      MAX_TIMEOUT_RETRIES: String(maxTimeoutRetries),
      DELAY_WHEN_RETRY_SECONDS: delayWhenRetrying.toSeconds().toString(),
      ...(config.lambdasSentryDSN ? { SENTRY_DSN: config.lambdasSentryDSN } : {}),
      API_URL: apiServiceDnsAddress,
      QUEUE_URL: sourceQueue.queueUrl,
      DLQ_URL: dlq.queueUrl,
      CONVERSION_RESULT_QUEUE_URL: destinationQueue.queueUrl,
      CONVERSION_RESULT_BUCKET_NAME: fhirConverterBucket.bucketName,
      SIDECHAIN_FHIR_CONVERTER_URL: sidechainFHIRConverterUrl,
      SIDECHAIN_FHIR_CONVERTER_URL_BLACKLIST: sidechainUrlBlacklist,
      SIDECHAIN_FHIR_CONVERTER_WORDS_TO_REMOVE: sidechainWordsToRemove,
      ...config.sidechainFHIRConverter.secretNames,
    },
    timeout: lambdaTimeout,
    alarmSnsAction,
    runtime: Runtime.NODEJS_18_X,
  });

  if (createRetryLambda) {
    defaultCreateRetryLambda({
      stack,
      name: connectorName,
      sharedNodeModules,
      sourceQueue: dlq,
      destinationQueue: destinationQueue,
    });
  }

  // grant lambda read access to all configured secrets
  const secrets: Secrets = {};
  buildSecrets(secrets, stack, config.sidechainFHIRConverter.secretNames);
  for (const secret of Object.values(secrets)) {
    secret.grantRead(conversionLambda);
  }

  fhirConverterBucket.grantReadWrite(conversionLambda);

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
  provideAccessToQueue({ accessType: "send", queue: sourceQueue, resource: apiTaskRole });

  medicalDocumentsBucket && medicalDocumentsBucket.grantRead(conversionLambda);

  return conversionLambda;
}
