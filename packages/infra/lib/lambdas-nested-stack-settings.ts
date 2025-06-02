import { Duration } from "aws-cdk-lib";
import * as lambda from "aws-cdk-lib/aws-lambda";

export function getConsolidatedIngestionConnectorSettings() {
  const lambdaTimeout = Duration.minutes(5);
  return {
    name: "ConsolidatedIngestion",
    queue: {
      fifo: true,
      createRetryLambda: false,
      maxReceiveCount: 2,
      alarmMaxAgeOfOldestMessage: Duration.seconds(lambdaTimeout.toSeconds() * 3),
      maxMessageCountAlarmThreshold: 5_000,
      visibilityTimeout: Duration.seconds(lambdaTimeout.toSeconds() * 2 + 1),
      receiveMessageWaitTime: Duration.seconds(2),
    },
    lambda: {
      runtime: lambda.Runtime.NODEJS_20_X,
      memory: 2048,
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
