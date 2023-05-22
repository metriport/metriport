import { Duration } from "aws-cdk-lib";
import { IVpc } from "aws-cdk-lib/aws-ec2";
import { SqsEventSource } from "aws-cdk-lib/aws-lambda-event-sources";
import { DeadLetterQueue, Queue } from "aws-cdk-lib/aws-sqs";
import { Construct } from "constructs";
import { EnvType } from "../env-type";
import { createLambda as defaultCreateLambda } from "../shared/lambda";
import { createQueue as defaultCreateQueue, provideAccess } from "../shared/sqs";

const lambdaTimeoutSeconds = 60;
const sqsToLambdaBatchSize = 1; // Amount of messages the lambda pull from SQS at once

export function createQueue({ stack, vpc }: { stack: Construct; vpc: IVpc }): {
  queue: Queue;
  dlq: DeadLetterQueue;
} {
  const queue = defaultCreateQueue({
    stack,
    name: "FHIRConverter",
    vpc,
    // To use FIFO we'd need to change the lambda code to set visibilityTimeout=0 on messages to be
    // reprocessed, instead of re-enqueueing them (bc of messageDeduplicationId visibility of 5min)
    fifo: false,
    visibilityTimeout: Duration.seconds(lambdaTimeoutSeconds * 6 + 1),
  });

  const dlq = queue.deadLetterQueue;
  if (!dlq) throw Error(`Missing DLQ of Queue ${queue.queueName}`);

  return { queue, dlq };
}

export function createLambda({
  envType,
  stack,
  vpc,
  queue,
  dlq,
  fhirServerAddress,
}: {
  envType: EnvType;
  stack: Construct;
  vpc: IVpc;
  queue: Queue;
  dlq: DeadLetterQueue;
  fhirServerAddress: string;
}) {
  const conversionLambda = defaultCreateLambda({
    stack,
    name: "FHIRConverter",
    vpc,
    subnets: vpc.privateSubnets,
    entry: "../api/lambdas/fhir-converter/index.js",
    envVars: {
      ENV_TYPE: envType,
      QUEUE_URL: queue.queueUrl,
      DLQ_URL: dlq.queue.queueUrl,
      FHIR_SERVER_URL: `${fhirServerAddress}/internal/fhir/result-conversion`,
    },
    timeout: Duration.seconds(lambdaTimeoutSeconds),
  });

  // TODO 706 implement partial batch response:
  // https://docs.aws.amazon.com/prescriptive-guidance/latest/lambda-event-filtering-partial-batch-responses-for-sqs/welcome.html
  conversionLambda.addEventSource(
    new SqsEventSource(queue, {
      batchSize: sqsToLambdaBatchSize,
      reportBatchItemFailures: true,
    })
  );
  provideAccess({ accessType: "both", queue, resource: conversionLambda });
  provideAccess({ accessType: "send", queue: dlq.queue, resource: conversionLambda });

  return { queue, dlq };
}
