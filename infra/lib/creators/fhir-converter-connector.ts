import { Duration } from "aws-cdk-lib";
import { SnsAction } from "aws-cdk-lib/aws-cloudwatch-actions";
import { IVpc } from "aws-cdk-lib/aws-ec2";
import { IGrantable } from "aws-cdk-lib/aws-iam";
import { Function as Lambda, ILayerVersion } from "aws-cdk-lib/aws-lambda";
import { SqsEventSource } from "aws-cdk-lib/aws-lambda-event-sources";
import * as s3 from "aws-cdk-lib/aws-s3";
import { IQueue } from "aws-cdk-lib/aws-sqs";
import { Construct } from "constructs";
import { EnvType } from "../env-type";
import { FHIRConnector } from "../fhir-connector-stack";
import { getConfig, METRICS_NAMESPACE } from "../shared/config";
import { createLambda as defaultCreateLambda } from "../shared/lambda";
import { createQueue as defaultCreateQueue, provideAccessToQueue } from "../shared/sqs";
import { settings as settingsFhirConverter } from "./fhir-converter-service";

function settings() {
  const {
    cpuAmount: fhirConverterCPUAmount,
    taskCountMin: fhirConverterTaskCounMin,
    maxExecutionTimeout,
  } = settingsFhirConverter();
  const lambdaTimeout = maxExecutionTimeout.minus(Duration.seconds(5));
  return {
    connectorName: "FHIRConverter",
    lambdaMemory: 512,
    // Number of messages the lambda pull from SQS at once
    lambdaBatchSize: 1,
    // Max number of concurrent instances of the lambda that an Amazon SQS event source can invoke [2 - 1000].
    maxConcurrency: fhirConverterCPUAmount * fhirConverterTaskCounMin,
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
  const queue = defaultCreateQueue({
    stack,
    name: connectorName,
    // To use FIFO we'd need to change the lambda code to set visibilityTimeout=0 on messages to be
    // reprocessed, instead of re-enqueueing them (bc of messageDeduplicationId visibility of 5min)
    fifo: false,
    visibilityTimeout,
    maxReceiveCount,
    alarmSnsAction,
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
  envType,
  stack,
  sharedNodeModules,
  vpc,
  sourceQueue,
  destinationQueue,
  dlq,
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

  const converterLambda = defaultCreateLambda({
    stack,
    name: connectorName,
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
    },
    timeout: lambdaTimeout,
    alarmSnsAction,
  });

  medicalDocumentsBucket && medicalDocumentsBucket.grantRead(converterLambda);
  fhirConverterBucket.grantReadWrite(converterLambda);

  converterLambda.addEventSource(
    new SqsEventSource(sourceQueue, {
      batchSize: lambdaBatchSize,
      // Partial batch response: https://docs.aws.amazon.com/prescriptive-guidance/latest/lambda-event-filtering-partial-batch-responses-for-sqs/welcome.html
      reportBatchItemFailures: true,
      maxConcurrency,
    })
  );
  provideAccessToQueue({ accessType: "both", queue: sourceQueue, resource: converterLambda });
  provideAccessToQueue({ accessType: "send", queue: dlq, resource: converterLambda });
  provideAccessToQueue({ accessType: "send", queue: destinationQueue, resource: converterLambda });
  provideAccessToQueue({ accessType: "send", queue: sourceQueue, resource: apiTaskRole });

  return converterLambda;
}
