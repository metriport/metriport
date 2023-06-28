import { IQueue } from "aws-cdk-lib/aws-sqs";

export type QueueGroup = {
  queue: IQueue;
  dlq: IQueue;
  createRetryLambda?: boolean;
};

export type QueueGroupARNs = {
  queueArn: string;
  dlqArn: string;
  createRetryLambda?: boolean;
};
