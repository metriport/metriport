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

const waitTimePatientSync = Duration.seconds(60); // 1 patient/min

function settings() {
  const syncPatientLambdaTimeout = waitTimePatientSync.plus(Duration.seconds(25));
  const syncPatient: QueueAndLambdaSettings = {
    name: "EhrSyncPatient",
    entry: "ehr-sync-patient",
    lambda: {
      memory: 1024,
      batchSize: 1,
      timeout: syncPatientLambdaTimeout,
      reportBatchItemFailures: true,
    },
    queue: {
      alarmMaxAgeOfOldestMessage: Duration.days(2),
      maxMessageCountAlarmThreshold: 5_000,
      maxReceiveCount: 3,
      visibilityTimeout: Duration.seconds(syncPatientLambdaTimeout.toSeconds() * 2 + 1),
      createRetryLambda: false,
    },
    waitTime: waitTimePatientSync,
  };
  return {
    syncPatient,
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
  waitTime: Duration;
};

interface EhrNestedStackProps extends NestedStackProps {
  config: EnvConfig;
  vpc: ec2.IVpc;
  alarmAction?: SnsAction;
  lambdaLayers: LambdaLayers;
}

export class EhrNestedStack extends NestedStack {
  readonly syncPatientLambda: Lambda;
  readonly syncPatientQueue: Queue;

  constructor(scope: Construct, id: string, props: EhrNestedStackProps) {
    super(scope, id, props);

    this.terminationProtection = true;

    const syncPatient = this.setupSyncPatient({
      lambdaLayers: props.lambdaLayers,
      vpc: props.vpc,
      envType: props.config.environmentType,
      sentryDsn: props.config.lambdasSentryDSN,
      alarmAction: props.alarmAction,
    });
    this.syncPatientLambda = syncPatient.lambda;
    this.syncPatientQueue = syncPatient.queue;
  }

  private setupSyncPatient(ownProps: {
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
      waitTime,
    } = settings().syncPatient;

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
        WAIT_TIME_IN_MILLIS: waitTime.toMilliseconds().toString(),
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
