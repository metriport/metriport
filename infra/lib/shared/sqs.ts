import { Duration } from "aws-cdk-lib";
import { IVpc } from "aws-cdk-lib/aws-ec2";
import { IGrantable } from "aws-cdk-lib/aws-iam";
import { IQueue, Queue } from "aws-cdk-lib/aws-sqs";
import { Construct } from "constructs/lib/construct";
import { createRetryLambda, DEFAULT_LAMBDA_TIMEOUT_SECONDS } from "./lambda";

export type QueueProps = (StandardQueueProps | FifoQueueProps) & {
  dlq?: never;
  vpc: IVpc;
  producer?: IGrantable;
  consumer?: IGrantable;
  createDLQ?: boolean;
  createRetryLambda?: boolean;
};

/**
 * Creates a SQS queue.
 *
 * @param props.createDLQ - create a dead letter queue, default true
 * @param props.createRetryLambda - create a lambda to retry messages on DLQ, default true
 * @param props.fifo - whether to create a FIFO queue or not, default false
 * @returns
 */
export function createQueue(props: QueueProps): Queue {
  const dlq =
    props.createDLQ === false ? undefined : defaultDLQ(props.stack, props.name, props.fifo);
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

  const retryLambda = props.createRetryLambda != null ? props.createRetryLambda : true;
  if (dlq && retryLambda) {
    createRetryLambda({
      ...props,
      sourceQueue: dlq,
      destinationQueue: queue,
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
    visibilityTimeout:
      props.visibilityTimeout ?? Duration.seconds(DEFAULT_LAMBDA_TIMEOUT_SECONDS * 6 + 1),
    deadLetterQueue: props.dlq
      ? {
          maxReceiveCount:
            props.maxReceiveCount && props.maxReceiveCount > 0 ? props.maxReceiveCount : 1,
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
    /**
     * ...set the source queue's visibility timeout to at least six times the timeout that
     * you configure on your function/lambda:
     * https://docs.aws.amazon.com/lambda/latest/dg/with-sqs.html#events-sqs-queueconfig
     * https://docs.aws.amazon.com/AWSSimpleQueueService/latest/SQSDeveloperGuide/sqs-visibility-timeout.html
     */
    visibilityTimeout:
      props.visibilityTimeout ?? Duration.seconds(DEFAULT_LAMBDA_TIMEOUT_SECONDS * 6 + 1),
    contentBasedDeduplication: props.contentBasedDeduplication ?? false, // if false, expects MessageDeduplicationId on message
    deadLetterQueue: props.dlq
      ? {
          maxReceiveCount:
            props.maxReceiveCount && props.maxReceiveCount > 0 ? props.maxReceiveCount : 1,
          queue: props.dlq,
        }
      : undefined,
  });
}

export const defaultDLQ = (scope: Construct, name: string, fifo?: boolean): Queue => {
  return new Queue(scope, name + "DLQ", {
    queueName: fifo ? name + "DLQ.fifo" : name + "DLQ",
    fifo: fifo === true ? true : undefined, // https://github.com/aws/aws-cdk/issues/8550
    retentionPeriod: Duration.days(14),
    deliveryDelay: Duration.millis(0),
    receiveMessageWaitTime: Duration.millis(0),
    visibilityTimeout: Duration.hours(12), // in case we need time to process this manually
  });
};

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
