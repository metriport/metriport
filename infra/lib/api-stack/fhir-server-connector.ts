import { Duration } from "aws-cdk-lib";
import { IVpc } from "aws-cdk-lib/aws-ec2";
import { SqsEventSource } from "aws-cdk-lib/aws-lambda-event-sources";
import * as s3 from "aws-cdk-lib/aws-s3";
import { Queue } from "aws-cdk-lib/aws-sqs";
import { Construct } from "constructs";
import { EnvType } from "../env-type";
import { getConfig } from "../shared/config";
import { createLambda as defaultCreateLambda } from "../shared/lambda";
import { createQueue as defaultCreateQueue, provideAccess } from "../shared/sqs";

const connectorName = "FHIRServer";
const lambdaTimeoutSeconds = 60;
// Amount of messages the lambda pull from SQS at once
const lambdaBatchSize = 1;
// Amount of lambda instances running in parallel (fixed if set - doesn't scale out/in, scalable if undefined)
const reservedConcurrentExecutions = undefined;

export function createConnector({
  envType,
  stack,
  vpc,
  fhirConverterBucket,
}: {
  envType: EnvType;
  stack: Construct;
  vpc: IVpc;
  fhirConverterBucket: s3.Bucket;
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
    visibilityTimeout: Duration.seconds(lambdaTimeoutSeconds * 6 + 1),
  });

  const dlq = queue.deadLetterQueue;
  if (!dlq) throw Error(`Missing DLQ of Queue ${queue.queueName}`);

  const sqsToFhirLambda = defaultCreateLambda({
    stack,
    name: connectorName,
    vpc,
    subnets: vpc.privateSubnets,
    entry: "../api/lambdas/sqs-to-fhir/index.js",
    envVars: {
      ENV_TYPE: envType,
      ...(config.sentryDSN ? { SENTRY_DSN: config.sentryDSN } : undefined),
      QUEUE_URL: queue.queueUrl,
      DLQ_URL: dlq.queue.queueUrl,
      ...(fhirServerUrl && {
        FHIR_SERVER_URL: config.fhirServerUrl,
      }),
    },
    timeout: Duration.seconds(lambdaTimeoutSeconds),
    reservedConcurrentExecutions,
  });

  fhirConverterBucket.grantRead(sqsToFhirLambda);
  sqsToFhirLambda.addEventSource(
    new SqsEventSource(queue, {
      batchSize: lambdaBatchSize,
      // Partial batch response: https://docs.aws.amazon.com/prescriptive-guidance/latest/lambda-event-filtering-partial-batch-responses-for-sqs/welcome.html
      reportBatchItemFailures: true,
    })
  );
  provideAccess({ accessType: "both", queue, resource: sqsToFhirLambda });
  provideAccess({ accessType: "send", queue: dlq.queue, resource: sqsToFhirLambda });

  return queue;
}
