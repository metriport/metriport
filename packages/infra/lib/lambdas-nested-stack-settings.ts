import { Duration, Size } from "aws-cdk-lib";
import * as lambda from "aws-cdk-lib/aws-lambda";
import { LambdaSettings, QueueAndLambdaSettingsFifo } from "./shared/settings";

// Single timeout for both lambdas b/c ingestion needs more time, and currently search might also ingest
const lambdaTimeout = Duration.minutes(15).minus(Duration.seconds(5));

export function getConsolidatedIngestionConnectorSettings(): Omit<
  QueueAndLambdaSettingsFifo,
  "lambda" | "entry" | "waitTime"
> & { lambda: LambdaSettings } {
  return {
    name: "ConsolidatedIngestion",
    queue: {
      fifo: true,
      createRetryLambda: false,
      maxReceiveCount: 1,
      alertMaxApproximateAgeOfOldestMessage: Duration.seconds(lambdaTimeout.toSeconds() * 3),
      alertMaxApproximateNumberOfMessagesVisible: 5_000,
      visibilityTimeout: Duration.seconds(lambdaTimeout.toSeconds() * 2 + 1),
      receiveMessageWaitTime: Duration.seconds(2),
    },
    lambda: {
      runtime: lambda.Runtime.NODEJS_20_X,
      memory: 4096,
      ephemeralStorageSize: Size.gibibytes(2),
      timeout: lambdaTimeout,
    },
    eventSource: {
      batchSize: 1,
      maxConcurrency: 5, // how many lambdas can hit the OpenSearch service at once
      // Partial batch response: https://docs.aws.amazon.com/prescriptive-guidance/latest/lambda-event-filtering-partial-batch-responses-for-sqs/welcome.html
      reportBatchItemFailures: false,
    },
  };
}

export function getConsolidatedSearchConnectorSettings(): { name: string; lambda: LambdaSettings } {
  return {
    name: "ConsolidatedSearch",
    lambda: {
      runtime: lambda.Runtime.NODEJS_20_X,
      memory: 4096,
      ephemeralStorageSize: Size.gibibytes(2),
      timeout: lambdaTimeout,
    },
  };
}

/**
 * Settings for the queued FhirToBundle lambda used by oncall for bulk operations.
 * The queue allows oncall to enqueue many requests without overwhelming the system.
 * Throttling is controlled via maxConcurrency on the SQS event source.
 */
export function getFhirToBundleQueuedSettings(): Omit<
  QueueAndLambdaSettingsFifo,
  "entry" | "waitTime"
> & { lambda: LambdaSettings } {
  return {
    name: "FhirToBundleQueued",
    queue: {
      fifo: true,
      createRetryLambda: false,
      maxReceiveCount: 3,
      alertMaxApproximateAgeOfOldestMessage: Duration.hours(24),
      alertMaxApproximateNumberOfMessagesVisible: 20_000,
      visibilityTimeout: Duration.seconds(lambdaTimeout.toSeconds() * 2 + 1),
      receiveMessageWaitTime: Duration.seconds(2),
    },
    lambda: {
      runtime: lambda.Runtime.NODEJS_20_X,
      memory: 6144,
      ephemeralStorageSize: Size.gibibytes(4),
      timeout: lambdaTimeout,
    },
    eventSource: {
      batchSize: 1,
      maxConcurrency: 5,
      reportBatchItemFailures: false,
    },
  };
}
