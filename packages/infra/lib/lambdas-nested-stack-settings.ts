import { Duration, Size } from "aws-cdk-lib";
import * as lambda from "aws-cdk-lib/aws-lambda";
import { LambdaSettings, QueueAndLambdaSettings } from "./shared/settings";

// Single timeout for both lambdas b/c ingestion needs more time, and currently search might also ingest
const lambdaTimeout = Duration.minutes(15).minus(Duration.seconds(5));

export function getConsolidatedIngestionConnectorSettings(): Omit<
  QueueAndLambdaSettings,
  "lambda" | "entry" | "waitTime"
> & { lambda: LambdaSettings } {
  return {
    name: "ConsolidatedIngestion",
    queue: {
      fifo: true,
      createRetryLambda: false,
      maxReceiveCount: 1,
      alarmMaxAgeOfOldestMessage: Duration.seconds(lambdaTimeout.toSeconds() * 3),
      maxMessageCountAlarmThreshold: 5_000,
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
