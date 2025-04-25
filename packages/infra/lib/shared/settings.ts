import { Duration } from "aws-cdk-lib";

export type SettingsRecord = Record<string, QueueAndLambdaSettings>;

export type QueueAndLambdaSettings = {
  name: string;
  entry: string;
  lambda: {
    memory: 512 | 1024 | 2048 | 4096;
    /** How long can the lambda run for, max is 900 seconds (15 minutes)  */
    timeout: Duration;
    reservedConcurrentExecutions?: number;
  };
  queue: {
    alarmMaxAgeOfOldestMessage: Duration;
    maxMessageCountAlarmThreshold?: number;
    /** The number of times a message can be unsuccesfully dequeued before being moved to the dead-letter queue. */
    maxReceiveCount: number;
    /** How long messages should be invisible for other consumers, based on the lambda timeout */
    /** We don't care if the message gets reprocessed, so no need to have a huge visibility timeout that makes it harder to move messages to the DLQ */
    visibilityTimeout: Duration;
    createRetryLambda: boolean;
  };
  eventSource: {
    /** Number of messages the lambda pull from SQS at once  */
    batchSize: number;
    /** Partial batch response: https://docs.aws.amazon.com/prescriptive-guidance/latest/lambda-event-filtering-partial-batch-responses-for-sqs/welcome.html */
    reportBatchItemFailures: boolean;
    maxConcurrency?: number;
    maxBatchingWindow?: Duration;
  };
  waitTime: Duration;
};
