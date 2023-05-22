import { Duration, StackProps } from "aws-cdk-lib";
import { IVpc } from "aws-cdk-lib/aws-ec2";
import { IGrantable } from "aws-cdk-lib/aws-iam";
import { Queue } from "aws-cdk-lib/aws-sqs";
import { Construct } from "constructs/lib/construct";
import { createRetryLambda, DEFAULT_LAMBDA_TIMEOUT_SECONDS } from "./lambda";

// Relevant API docs:
// https://docs.aws.amazon.com/cdk/api/latest/docs/@aws-cdk_aws-sqs.QueueProps.html#contentbaseddeduplication

export interface QueueProps extends Omit<DefaultQueueStackProps, "dlq"> {
  readonly vpc: IVpc;
  readonly producer?: IGrantable;
  readonly consumer?: IGrantable;
  readonly createDLQ?: boolean;
  readonly createRetryLambda?: boolean;
}

/**
 * Creates a SQS queue.
 *
 * @param props.createDLQ - create a dead letter queue, default true
 * @param props.createRetryLambda - create a lambda to retry messages on DLQ, default true
 * @returns
 */
export function createQueue(props: QueueProps): Queue {
  const dlq = props.createDLQ === false ? undefined : defaultDLQ(props.stack, props.name);
  const queue = createFifoQueue({
    ...props,
    ...(dlq ? { dlq: dlq } : {}),
  });
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

interface DefaultQueueStackProps extends StackProps {
  readonly stack: Construct;
  readonly name: string;
  readonly dlq?: Queue;
  readonly visibilityTimeout?: Duration;
  readonly deliveryDelay?: Duration;
  readonly receiveMessageWaitTime?: Duration;
  readonly maxReceiveCount?: number;
  readonly contentBasedDeduplication?: boolean;
}

const createFifoQueue = (props: DefaultQueueStackProps): Queue =>
  new Queue(props.stack, props.name + "Queue", {
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

export const defaultDLQ = (scope: Construct, name: string): Queue => {
  return new Queue(scope, name + "DLQ", {
    queueName: name + "DLQ.fifo",
    fifo: true,
    retentionPeriod: Duration.days(14),
    deliveryDelay: Duration.millis(0),
    receiveMessageWaitTime: Duration.millis(0),
    visibilityTimeout: Duration.hours(12),
  });
};
