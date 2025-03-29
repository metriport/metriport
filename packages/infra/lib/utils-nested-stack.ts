import { Duration, NestedStack, NestedStackProps } from "aws-cdk-lib";
import { SnsAction } from "aws-cdk-lib/aws-cloudwatch-actions";
import * as ec2 from "aws-cdk-lib/aws-ec2";
import { Function as Lambda } from "aws-cdk-lib/aws-lambda";
import { SqsEventSource } from "aws-cdk-lib/aws-lambda-event-sources";
import { Queue } from "aws-cdk-lib/aws-sqs";
import { Construct } from "constructs";
import { EnvConfig } from "../config/env-config";
import { EnvType } from "./env-type";
import { createLambda } from "./shared/lambda";
import { LambdaLayers } from "./shared/lambda-layers";
import { createQueue } from "./shared/sqs";

function settings() {
  const writeToS3LambdaTimeout = Duration.seconds(25);
  const writeToS3: QueueAndLambdaSettings = {
    name: "WriteToS3",
    entry: "write-to-s3",
    lambda: {
      memory: 2048,
      batchSize: 100,
      timeout: writeToS3LambdaTimeout,
      reportBatchItemFailures: true,
    },
    queue: {
      alarmMaxAgeOfOldestMessage: Duration.hours(2),
      maxMessageCountAlarmThreshold: 5_000,
      maxReceiveCount: 3,
      visibilityTimeout: Duration.seconds(writeToS3LambdaTimeout.toSeconds() * 2 + 1),
      createRetryLambda: false,
    },
  };
  return {
    writeToS3,
  };
}

type QueueAndLambdaSettings = {
  name: string;
  entry: string;
  lambda: {
    memory: 512 | 1024 | 2048 | 4096;
    /** Number of messages the lambda pull from SQS at once  */
    batchSize: number;
    /** How long can the lambda run for, max is 900 seconds (15 minutes)  */
    timeout: Duration;
    /** Partial batch response: https://docs.aws.amazon.com/prescriptive-guidance/latest/lambda-event-filtering-partial-batch-responses-for-sqs/welcome.html */
    reportBatchItemFailures: boolean;
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
};

interface UtilsNestedStackProps extends NestedStackProps {
  config: EnvConfig;
  vpc: ec2.IVpc;
  alarmAction?: SnsAction;
  lambdaLayers: LambdaLayers;
}

export class UtilsNestedStack extends NestedStack {
  readonly writeToS3Lambda: Lambda;
  readonly writeToS3Queue: Queue;

  constructor(scope: Construct, id: string, props: UtilsNestedStackProps) {
    super(scope, id, props);

    this.terminationProtection = true;

    const writeToS3 = this.setupWriteToS3({
      lambdaLayers: props.lambdaLayers,
      vpc: props.vpc,
      envType: props.config.environmentType,
      sentryDsn: props.config.lambdasSentryDSN,
      alarmAction: props.alarmAction,
    });
    this.writeToS3Lambda = writeToS3.lambda;
    this.writeToS3Queue = writeToS3.queue;
  }

  private setupWriteToS3(ownProps: {
    lambdaLayers: LambdaLayers;
    vpc: ec2.IVpc;
    envType: EnvType;
    sentryDsn: string | undefined;
    alarmAction: SnsAction | undefined;
  }): { lambda: Lambda; queue: Queue } {
    const { lambdaLayers, vpc, envType, sentryDsn, alarmAction } = ownProps;
    const {
      name,
      entry,
      lambda: { memory, timeout, batchSize, reportBatchItemFailures },
      queue: {
        visibilityTimeout,
        maxReceiveCount,
        alarmMaxAgeOfOldestMessage,
        maxMessageCountAlarmThreshold,
        createRetryLambda,
      },
    } = settings().writeToS3;

    const queue = createQueue({
      stack: this,
      name,
      fifo: true,
      createDLQ: true,
      visibilityTimeout,
      maxReceiveCount,
      lambdaLayers: [lambdaLayers.shared],
      envType,
      alarmSnsAction: alarmAction,
      alarmMaxAgeOfOldestMessage,
      maxMessageCountAlarmThreshold,
      createRetryLambda,
    });

    const lambda = createLambda({
      stack: this,
      name,
      entry,
      envType,
      envVars: {
        // API_URL set on the api-stack after the OSS API is created
        ...(sentryDsn ? { SENTRY_DSN: sentryDsn } : {}),
      },
      layers: [lambdaLayers.shared],
      memory: memory,
      timeout: timeout,
      vpc,
      alarmSnsAction: alarmAction,
    });

    lambda.addEventSource(new SqsEventSource(queue, { batchSize, reportBatchItemFailures }));

    return { lambda, queue };
  }
}
