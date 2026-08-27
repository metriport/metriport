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

const DEFAULT_MAX_RECEIVE_COUNT = 5;
const DEFAULT_MAX_AGE_OF_OLDEST_MESSAGE = Duration.minutes(10);

export type QueueProps = (StandardQueueProps | FifoQueueProps) & {
  dlq?: never;
  producer?: IGrantable;
  consumer?: IGrantable;
  alertSnsAction?: SnsAction;
  alertMaxApproximateAgeOfOldestMessage?: Duration;
  createDLQ?: boolean | undefined;
  createRetryLambda?: boolean | undefined;
  lambdaLayers?: ILayerVersion[];
  envType: EnvType;
  alertMaxApproximateAgeOfOldestMessageDlq?: Duration;
  alertMaxApproximateNumberOfMessagesVisible?: number;
  alertMaxNumberOfMessagesReceived?: number;
  alertMaxApproximateNumberOfMessagesVisibleDlq?: number;
};

/**
 * Creates a SQS queue.
 *
 * @param props.createDLQ - create a dead letter queue, default true
 * @param props.createRetryLambda - create a lambda to retry messages on DLQ, default true
 * @param props.fifo - whether to create a FIFO queue or not, default false
 * @param props.alertMaxApproximateAgeOfOldestMessage - the maximum approximate age of the oldest message in the queue before
 * an alarm is triggered
 * @param props.alertMaxApproximateNumberOfMessagesVisible - the maximum approximate number of visible messages in the queue
 * before an alarm is triggered
 * @param props.alertMaxNumberOfMessagesReceived - the maximum number of messages received in the queue before an alarm is triggered
 * @param props.alertMaxApproximateAgeOfOldestMessageDlq - the maximum approximate age of the oldest message in the
 * DLQ before an alarm is triggered
 * @param props.alertMaxApproximateNumberOfMessagesVisibleDlq - the maximum approximate number of visible messages in the
 * DLQ before an alarm is triggered
 * @returns
 */
export function createQueue(props: QueueProps): Queue {
  const alertMaxApproximateAgeOfOldestMessage =
    props.alertMaxApproximateAgeOfOldestMessage ?? DEFAULT_MAX_AGE_OF_OLDEST_MESSAGE;
  const createDLQ = props.createDLQ !== false;

  const dlq = createDLQ
    ? defaultDLQ(props.stack, props.name, props.fifo, {
        alertSnsAction: props.alertSnsAction,
        alertMaxApproximateAgeOfOldestMessage: props.alertMaxApproximateAgeOfOldestMessageDlq,
        alertMaxApproximateNumberOfMessagesVisible:
          props.alertMaxApproximateNumberOfMessagesVisibleDlq,
      })
    : undefined;
  const isCreateRetryLambda = props.createRetryLambda ?? true;
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

  if (props.alertMaxNumberOfMessagesReceived) {
    addNumberOfMessagesReceivedAlarmToQueue({
      stack: props.stack,
      queue,
      threshold: props.alertMaxNumberOfMessagesReceived,
      alarmName: `${props.name}-MessageCount-Alarm`,
      alarmAction: props?.alertSnsAction,
    });
  }

  const alertMaxApproximateNumberOfMessagesVisible =
    props.alertMaxApproximateNumberOfMessagesVisible;
  if (alertMaxApproximateNumberOfMessagesVisible) {
    addApproximateNumberOfMessagesVisibleAlarmToQueue({
      stack: props.stack,
      queue,
      threshold: alertMaxApproximateNumberOfMessagesVisible,
      alarmName: `${props.name}-ApproximateNumberOfMessagesVisible-Alarm`,
      alarmAction: props?.alertSnsAction,
    });
  }

  addMaxAgeOfOldestMessageAlarmToQueue({
    stack: props.stack,
    queue,
    threshold: alertMaxApproximateAgeOfOldestMessage,
    alarmName: `${props.name}-ApproximateAgeOfOldestMessage-Alarm`,
    alarmAction: props?.alertSnsAction,
  });

  if (dlq && isCreateRetryLambda) {
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
  alertSnsAction?: SnsAction;
  alertMaxApproximateAgeOfOldestMessage?: Duration;
  alertMaxApproximateNumberOfMessagesVisible?: number;
};

export function defaultDLQ(
  scope: Construct,
  name: string,
  fifo?: boolean,
  {
    alertSnsAction,
    alertMaxApproximateAgeOfOldestMessage,
    alertMaxApproximateNumberOfMessagesVisible,
  }: DefaultDLQProps = {}
): Queue {
  const dlq = new Queue(scope, name + "DLQ", {
    queueName: fifo ? name + "DLQ.fifo" : name + "DLQ",
    fifo: fifo === true ? true : undefined, // https://github.com/aws/aws-cdk/issues/8550
    retentionPeriod: Duration.days(14),
    deliveryDelay: Duration.millis(0),
    receiveMessageWaitTime: Duration.millis(0),
    visibilityTimeout: Duration.minutes(1),
  });

  if (alertMaxApproximateNumberOfMessagesVisible) {
    addApproximateNumberOfMessagesVisibleAlarmToQueue({
      stack: scope,
      queue: dlq,
      threshold: alertMaxApproximateNumberOfMessagesVisible,
      alarmName: `${name}-DLQ-Alarm`,
      alarmAction: alertSnsAction,
    });
  }

  if (alertMaxApproximateAgeOfOldestMessage) {
    addMaxAgeOfOldestMessageAlarmToQueue({
      stack: scope,
      queue: dlq,
      threshold: alertMaxApproximateAgeOfOldestMessage,
      alarmName: `${name}Dlq-ApproximateAgeOfOldestMessage-Alarm`,
      alarmAction: alertSnsAction,
    });
  }

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

export function addApproximateNumberOfMessagesVisibleAlarmToQueue({
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
  const metric = queue.metricApproximateNumberOfMessagesVisible({
    period: Duration.minutes(1),
    statistic: Stats.MAXIMUM,
  });
  const alarm = metric.createAlarm(stack, alarmName, {
    threshold,
    evaluationPeriods: 1,
    alarmDescription: `Alarm if the approximate amount of visible messages in the queue is greater than or equal to the threshold (${threshold}) for 1 evaluation period`,
    treatMissingData: cloudwatch.TreatMissingData.NOT_BREACHING,
  });
  alarmAction && alarm.addAlarmAction(alarmAction);
}

export function addNumberOfMessagesReceivedAlarmToQueue({
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
    alarmDescription: `Alarm if the count of messages received is greater than or equal to the threshold (${threshold}) for 1 evaluation period`,
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
    alarmDescription: `Alarm if the age of the oldest message is greater than or equal to the threshold (${threshold.toSeconds()} seconds) for 1 evaluation period`,
    treatMissingData: cloudwatch.TreatMissingData.NOT_BREACHING,
  });

  if (alarmAction) {
    alarm.addAlarmAction(alarmAction);
  }
}
