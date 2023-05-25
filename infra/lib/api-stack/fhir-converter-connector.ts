import { Duration } from "aws-cdk-lib";
import { IVpc } from "aws-cdk-lib/aws-ec2";
import { Function as Lambda } from "aws-cdk-lib/aws-lambda";
import { SqsEventSource } from "aws-cdk-lib/aws-lambda-event-sources";
import * as s3 from "aws-cdk-lib/aws-s3";
import { DeadLetterQueue, Queue } from "aws-cdk-lib/aws-sqs";
import { Construct } from "constructs";
import { EnvType } from "../env-type";
import { settings as settingsFhirConverter } from "../fhir-converter-service";
import { getConfig } from "../shared/config";
import { createLambda as defaultCreateLambda } from "../shared/lambda";
import { createQueue as defaultCreateQueue, provideAccessToQueue } from "../shared/sqs";

function settings() {
  const { cpuAmount: fhirConverterCPUAmount, taskCountMin: fhirConverterTaskCounMin } =
    settingsFhirConverter();
  // How long can the lambda run for, max is 900 seconds (15 minutes)
  const lambdaTimeoutSeconds = 5 * 60;
  return {
    connectorName: "FHIRConverter",
    // Number of messages the lambda pull from SQS at once
    lambdaBatchSize: 1,
    // Number of lambda instances running in parallel (fixed if set - doesn't scale out/in, scalable if undefined)
    reservedConcurrentExecutions: fhirConverterCPUAmount * fhirConverterTaskCounMin,
    lambdaTimeoutSeconds,
    // How long will it take before Axios returns a timeout error - should be less than the lambda timeout
    axiosTimeoutSeconds: lambdaTimeoutSeconds - 10, // give the lambda some time to deal with the timeout
    // Number of times we want to retry a message that timed out when trying to be processed
    maxTimeoutRetries: 99,
  };
}

export function createQueueAndBucket({ stack, vpc }: { stack: Construct; vpc: IVpc }): {
  queue: Queue;
  dlq: DeadLetterQueue;
  bucket: s3.Bucket;
} {
  const config = getConfig();
  const { connectorName, lambdaTimeoutSeconds } = settings();
  const queue = defaultCreateQueue({
    stack,
    name: connectorName,
    vpc,
    // To use FIFO we'd need to change the lambda code to set visibilityTimeout=0 on messages to be
    // reprocessed, instead of re-enqueueing them (bc of messageDeduplicationId visibility of 5min)
    fifo: false,
    visibilityTimeout: Duration.seconds(lambdaTimeoutSeconds * 6 + 1),
  });

  const dlq = queue.deadLetterQueue;
  if (!dlq) throw Error(`Missing DLQ of Queue ${queue.queueName}`);

  const fhirConverterBucket = new s3.Bucket(stack, `${connectorName}Bucket`, {
    bucketName: config.fhirConverterBucketName,
    publicReadAccess: false,
    encryption: s3.BucketEncryption.S3_MANAGED,
  });

  return { queue, dlq, bucket: fhirConverterBucket };
}

export function createLambda({
  envType,
  stack,
  vpc,
  sourceQueue,
  destinationQueue,
  dlq,
  fhirConverterBucket,
  conversionResultQueueUrl,
}: {
  envType: EnvType;
  stack: Construct;
  vpc: IVpc;
  sourceQueue: Queue;
  destinationQueue: Queue;
  dlq: DeadLetterQueue;
  fhirConverterBucket: s3.Bucket;
  conversionResultQueueUrl: string;
}): Lambda {
  const config = getConfig();
  const {
    connectorName,
    lambdaTimeoutSeconds,
    lambdaBatchSize,
    reservedConcurrentExecutions,
    axiosTimeoutSeconds,
    maxTimeoutRetries,
  } = settings();
  const conversionLambda = defaultCreateLambda({
    stack,
    name: connectorName,
    vpc,
    subnets: vpc.privateSubnets,
    entry: "../api/lambdas/fhir-converter/index.js",
    envVars: {
      ENV_TYPE: envType,
      AXIOS_TIMEOUT_SECONDS: String(axiosTimeoutSeconds),
      MAX_TIMEOUT_RETRIES: String(maxTimeoutRetries),
      ...(config.sentryDSN ? { SENTRY_DSN: config.sentryDSN } : undefined),
      QUEUE_URL: sourceQueue.queueUrl,
      CONVERSION_RESULT_QUEUE_URL: conversionResultQueueUrl,
      CONVERSION_RESULT_BUCKET_NAME: fhirConverterBucket.bucketName,
    },
    timeout: Duration.seconds(lambdaTimeoutSeconds),
    reservedConcurrentExecutions,
  });

  fhirConverterBucket.grantReadWrite(conversionLambda);

  conversionLambda.addEventSource(
    new SqsEventSource(sourceQueue, {
      batchSize: lambdaBatchSize,
      // Partial batch response: https://docs.aws.amazon.com/prescriptive-guidance/latest/lambda-event-filtering-partial-batch-responses-for-sqs/welcome.html
      reportBatchItemFailures: true,
    })
  );
  provideAccessToQueue({ accessType: "both", queue: sourceQueue, resource: conversionLambda });
  provideAccessToQueue({ accessType: "send", queue: dlq.queue, resource: conversionLambda });
  provideAccessToQueue({ accessType: "send", queue: destinationQueue, resource: conversionLambda });

  return conversionLambda;
}
