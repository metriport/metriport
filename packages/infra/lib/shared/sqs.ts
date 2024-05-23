import { Duration } from "aws-cdk-lib";
import * as cloudwatch from "aws-cdk-lib/aws-cloudwatch";
import { Stats } from "aws-cdk-lib/aws-cloudwatch";
import { SnsAction } from "aws-cdk-lib/aws-cloudwatch-actions";
import { IGrantable } from "aws-cdk-lib/aws-iam";
import { ILayerVersion } from "aws-cdk-lib/aws-lambda";
import { IQueue, Queue } from "aws-cdk-lib/aws-sqs";
import { Construct } from "constructs/lib/construct";
import { EnvType } from "../env-type";
import { createRetryLambda, DEFAULT_LAMBDA_TIMEOUT } from "./lambda";

/**
 * ...set the source queue's visibility timeout to at least six times the timeout that
 * you configure on your function/lambda:
 * https://docs.aws.amazon.com/lambda/latest/dg/with-sqs.html#events-sqs-queueconfig
 * https://docs.aws.amazon.com/AWSSimpleQueueService/latest/SQSDeveloperGuide/sqs-visibility-timeout.html
 *
 * "The extra time allows for Lambda to retry if your function is throttled while processing a previous batch."
 * This seems to be the case mostly because of the possibility of a lambda being throttled, but in theory we would
 * only care about this on FIFO queues because we wouldn't want a new lambda to process a message while the original,
 * throttled lambda is about to keep processing it after its unthrottled.
 */
const DEFAULT_VISIBILITY_TIMEOUT_MULTIPLIER = 6;

const DEFAULT_MAX_RECEIVE_COUNT = 1;
const DEFAULT_MAX_AGE_OF_OLDEST_MESSAGE = Duration.minutes(10);

export type QueueProps = (StandardQueueProps | FifoQueueProps) & {
  dlq?: never;
  producer?: IGrantable;
  consumer?: IGrantable;
  alarmSnsAction?: SnsAction;
  alarmMaxAgeOfOldestMessage?: Duration;
} & (
    | {
        createDLQ: false;
        createRetryLambda: false;
      }
    | {
        createDLQ?: true | undefined;
        createRetryLambda?: true | undefined;
        lambdaLayers: ILayerVersion[];
        envType: EnvType;
        alarmMaxAgeOfOldestMessageDlq?: Duration;
      }
  );

/**
 * Creates a SQS queue.
 *
 * @param props.createDLQ - create a dead letter queue, default true
 * @param props.createRetryLambda - create a lambda to retry messages on DLQ (default true)
 * @param props.fifo - whether to create a FIFO queue or not, default false
 * @returns
 */
export function createQueue(props: QueueProps): Queue {
  const alarmMaxAgeOfOldestMessage =
    props.alarmMaxAgeOfOldestMessage ?? DEFAULT_MAX_AGE_OF_OLDEST_MESSAGE;
  const createDLQ = props.createDLQ !== false;
  const isParamCreateRetryLambda =
    props.createRetryLambda === undefined ? true : props.createRetryLambda;

  const dlq = createDLQ
    ? defaultDLQ(props.stack, props.name, props.fifo, {
        alarmSnsAction: props.alarmSnsAction,
        ...(props.alarmMaxAgeOfOldestMessageDlq
          ? { alarmMaxAgeOfOldestMessage: props.alarmMaxAgeOfOldestMessageDlq }
          : undefined),
      })
    : undefined;
  const defaultQueueProps = {
    ...(dlq ? { dlq: dlq } : {}),
  };
  const queue =
    props.fifo === true
      ? createFifoQueue({ ...defaultQueueProps, ...props })
      : createStandardQueue({ ...defaultQueueProps, ...props });
  props.producer && queue.grantSendMessages(props.producer);
  props.consumer && queue.grantConsumeMessages(props.consumer);
  props.consumer && dlq && dlq.grantSendMessages(props.consumer);

  addMaxAgeOfOldestMessageAlarmToQueue({
    stack: props.stack,
    queue,
    threshold: alarmMaxAgeOfOldestMessage,
    alarmName: `${props.name}-MaxAgeOldestMessage-Alarm`,
    alarmAction: props?.alarmSnsAction,
  });

  if (createDLQ && dlq && isParamCreateRetryLambda) {
    createRetryLambda({
      ...props,
      sourceQueue: dlq,
      destinationQueue: queue,
      layers: props.lambdaLayers ?? [],
    });
  }

  return queue;
}

type AbstractQueueProps = {
  stack: Construct;
  name: string;
  dlq?: Queue;
  // time a message is invisible to other consumers while its being processed, after this time it will be visible again (can be reprocessed)
  visibilityTimeout?: Duration;
  deliveryDelay?: Duration;
  receiveMessageWaitTime?: Duration;
  // maximum number of times a message can be processed before being automatically sent to the dead-letter queue
  maxReceiveCount?: number;
};
export type StandardQueueProps = AbstractQueueProps & {
  contentBasedDeduplication?: never;
  fifo?: never | false;
};

function createStandardQueue(props: StandardQueueProps): Queue {
  return new Queue(props.stack, props.name + "Queue", {
    queueName: props.name + "Queue",
    retentionPeriod: Duration.days(14),
    deliveryDelay: props.deliveryDelay ?? Duration.seconds(0),
    receiveMessageWaitTime: props.receiveMessageWaitTime ?? Duration.seconds(0),
    visibilityTimeout:
      props.visibilityTimeout ??
      Duration.seconds(
        DEFAULT_LAMBDA_TIMEOUT.toSeconds() * DEFAULT_VISIBILITY_TIMEOUT_MULTIPLIER + 1
      ),
    deadLetterQueue: props.dlq
      ? {
          maxReceiveCount:
            props.maxReceiveCount && props.maxReceiveCount > 0
              ? props.maxReceiveCount
              : DEFAULT_MAX_RECEIVE_COUNT,
          queue: props.dlq,
        }
      : undefined,
  });
}

export type FifoQueueProps = AbstractQueueProps & {
  contentBasedDeduplication?: boolean;
  fifo: true;
};

function createFifoQueue(props: FifoQueueProps): Queue {
  return new Queue(props.stack, props.name + "Queue", {
    queueName: props.name + "Queue.fifo",
    fifo: true,
    retentionPeriod: Duration.days(14),
    deliveryDelay: props.deliveryDelay ?? Duration.seconds(0),
    receiveMessageWaitTime: props.receiveMessageWaitTime ?? Duration.seconds(0),
    visibilityTimeout:
      props.visibilityTimeout ??
      Duration.seconds(
        DEFAULT_LAMBDA_TIMEOUT.toSeconds() * DEFAULT_VISIBILITY_TIMEOUT_MULTIPLIER + 1
      ),
    contentBasedDeduplication: props.contentBasedDeduplication ?? false, // if false, expects MessageDeduplicationId on message
    deadLetterQueue: props.dlq
      ? {
          maxReceiveCount:
            props.maxReceiveCount && props.maxReceiveCount > 0
              ? props.maxReceiveCount
              : DEFAULT_MAX_RECEIVE_COUNT,
          queue: props.dlq,
        }
      : undefined,
  });
}

export type DefaultDLQProps = {
  alarmSnsAction?: SnsAction;
  alarmMaxAgeOfOldestMessage?: Duration;
};

export function defaultDLQ(
  scope: Construct,
  name: string,
  fifo?: boolean,
  { alarmSnsAction, alarmMaxAgeOfOldestMessage = Duration.minutes(10) }: DefaultDLQProps = {}
): Queue {
  const dlq = new Queue(scope, name + "DLQ", {
    queueName: fifo ? name + "DLQ.fifo" : name + "DLQ",
    fifo: fifo === true ? true : undefined, // https://github.com/aws/aws-cdk/issues/8550
    retentionPeriod: Duration.days(14),
    deliveryDelay: Duration.millis(0),
    receiveMessageWaitTime: Duration.millis(0),
    visibilityTimeout: Duration.hours(12), // in case we need time to process this manually
  });

  addMessageCountAlarmToQueue({
    stack: scope,
    queue: dlq,
    threshold: 1,
    alarmName: `${name}-DLQ-Alarm`,
    alarmAction: alarmSnsAction,
  });

  addMaxAgeOfOldestMessageAlarmToQueue({
    stack: scope,
    queue: dlq,
    threshold: alarmMaxAgeOfOldestMessage,
    alarmName: `${name}Dlq-MaxAgeOldestMessage-Alarm`,
    alarmAction: alarmSnsAction,
  });

  return dlq;
}

export type AccessType = "send" | "receive" | "both";

export function provideAccessToQueue({
  queue,
  accessType,
  resource,
}: {
  queue: IQueue;
  accessType: AccessType;
  resource: IGrantable;
}): void {
  const sendOrBoth: AccessType[] = ["both", "send"];
  if (sendOrBoth.includes(accessType)) queue.grantSendMessages(resource);

  const receiveOrBoth: AccessType[] = ["both", "receive"];
  if (receiveOrBoth.includes(accessType)) queue.grantConsumeMessages(resource);
}

export function addMessageCountAlarmToQueue({
  stack,
  queue,
  threshold,
  alarmName,
  alarmAction,
}: {
  stack: Construct;
  queue: Queue;
  threshold: number;
  alarmName: string;
  alarmAction?: SnsAction;
}) {
  const errMetric = queue.metricNumberOfMessagesReceived({
    period: Duration.minutes(1),
    statistic: Stats.SUM,
  });
  const alarm = errMetric.createAlarm(stack, alarmName, {
    threshold,
    evaluationPeriods: 1,
    alarmDescription: `Alarm if the count of messages greater than or equal to the threshold (${threshold}) for 1 evaluation period`,
    treatMissingData: cloudwatch.TreatMissingData.NOT_BREACHING,
  });
  alarmAction && alarm.addAlarmAction(alarmAction);
}

export function addMaxAgeOfOldestMessageAlarmToQueue({
  stack,
  queue,
  threshold,
  alarmName,
  alarmAction,
}: {
  stack: Construct;
  queue: Queue;
  threshold: Duration;
  alarmName: string;
  alarmAction?: SnsAction;
}) {
  const metric = queue.metricApproximateAgeOfOldestMessage({
    period: Duration.minutes(1),
    statistic: Stats.MAXIMUM,
  });
  const alarm = metric.createAlarm(stack, alarmName, {
    threshold: threshold.toSeconds(),
    evaluationPeriods: 1,
    alarmDescription: `Alarm if the age of the oldest message is greater than threshold for 1 evaluation period`,
    treatMissingData: cloudwatch.TreatMissingData.NOT_BREACHING,
  });
  alarmAction && alarm.addAlarmAction(alarmAction);
}
