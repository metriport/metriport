import { CfnOutput, Duration, NestedStack, NestedStackProps } from "aws-cdk-lib";
import { SnsAction } from "aws-cdk-lib/aws-cloudwatch-actions";
import * as ec2 from "aws-cdk-lib/aws-ec2";
import { Function as Lambda } from "aws-cdk-lib/aws-lambda";
import { SqsEventSource } from "aws-cdk-lib/aws-lambda-event-sources";
import * as s3 from "aws-cdk-lib/aws-s3";
import { Construct } from "constructs";
import { EnvConfig } from "../config/env-config";
import { EnvType } from "./env-type";
import { createLambda } from "./shared/lambda";
import { LambdaLayers } from "./shared/lambda-layers";
import { QueueAndLambdaSettings } from "./shared/settings";
import { createQueue } from "./shared/sqs";

const waitTimeHl7NotificationWebhookSender = Duration.millis(50); // 1200 messages/min

function settings(): { hl7NotificationWebhookSender: QueueAndLambdaSettings } {
  const timeout = Duration.seconds(61);
  const hl7NotificationWebhookSender: QueueAndLambdaSettings = {
    name: "Hl7NotificationWebhookSender",
    entry: "hl7-notification-webhook-sender",
    lambda: {
      memory: 1024,
      batchSize: 1,
      timeout,
      reportBatchItemFailures: true,
    },
    queue: {
      alarmMaxAgeOfOldestMessage: Duration.minutes(5),
      maxReceiveCount: 3,
      visibilityTimeout: Duration.seconds(timeout.toSeconds() * 2 + 1),
      createRetryLambda: false,
      maxMessageCountAlarmThreshold: 5_000,
    },
    waitTime: waitTimeHl7NotificationWebhookSender,
  };

  return {
    hl7NotificationWebhookSender,
  };
}

interface Hl7NotificationWebhookSenderNestedStackProps extends NestedStackProps {
  config: EnvConfig;
  vpc: ec2.IVpc;
  alarmAction?: SnsAction;
  lambdaLayers: LambdaLayers;
  outgoingHl7NotificationBucket: s3.Bucket;
}

export class Hl7NotificationWebhookSenderNestedStack extends NestedStack {
  public readonly lambda: Lambda;

  constructor(scope: Construct, id: string, props: Hl7NotificationWebhookSenderNestedStackProps) {
    super(scope, id, props);

    this.terminationProtection = true;

    const setup = this.setupHl7NotificationWebhookSenderLambda({
      lambdaLayers: props.lambdaLayers,
      vpc: props.vpc,
      envType: props.config.environmentType,
      sentryDsn: props.config.lambdasSentryDSN,
      alarmAction: props.alarmAction,
      outgoingHl7NotificationBucket: props.outgoingHl7NotificationBucket,
    });

    this.lambda = setup.lambda;
  }

  private setupHl7NotificationWebhookSenderLambda(ownProps: {
    lambdaLayers: LambdaLayers;
    vpc: ec2.IVpc;
    envType: EnvType;
    sentryDsn: string | undefined;
    alarmAction: SnsAction | undefined;
    outgoingHl7NotificationBucket: s3.Bucket;
  }): { lambda: Lambda } {
    const { lambdaLayers, vpc, sentryDsn, envType, alarmAction, outgoingHl7NotificationBucket } =
      ownProps;
    const {
      name,
      entry,
      lambda: lambdaSettings,
      queue: queueSettings,
      waitTime,
    } = settings().hl7NotificationWebhookSender;

    const queue = createQueue({
      ...queueSettings,
      name,
      stack: this,
      fifo: true,
      createDLQ: true,
      lambdaLayers: [lambdaLayers.shared],
      envType,
      alarmSnsAction: alarmAction,
    });

    const lambda = createLambda({
      ...lambdaSettings,
      name,
      entry,
      stack: this,
      envType,
      layers: [lambdaLayers.shared],
      vpc,
      alarmSnsAction: alarmAction,
      envVars: {
        // API_URL set on the api-stack after the OSS API is created
        WAIT_TIME_IN_MILLIS: waitTime.toMilliseconds().toString(),
        ...(sentryDsn ? { SENTRY_DSN: sentryDsn } : {}),
      },
    });

    outgoingHl7NotificationBucket.grantWrite(lambda);
    lambda.addEventSource(new SqsEventSource(queue));

    new CfnOutput(this, "Hl7NotificationWebhookSenderQueueArn", {
      description: "HL7 Message Router Queue ARN",
      value: queue.queueArn,
      exportName: "Hl7NotificationWebhookSenderQueueArn",
    });
    new CfnOutput(this, "Hl7NotificationWebhookSenderQueueUrl", {
      description: "HL7 Message Router Queue URL",
      value: queue.queueUrl,
      exportName: "Hl7NotificationWebhookSenderQueueUrl",
    });

    return { lambda };
  }
}
