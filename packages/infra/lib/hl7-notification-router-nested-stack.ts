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

const waitTimeHl7NotificationRouter = Duration.millis(50); // 1200 messages/min

function settings(): { hl7NotificationRouter: QueueAndLambdaSettings } {
  const timeout = Duration.minutes(3);
  const hl7NotificationRouter: QueueAndLambdaSettings = {
    name: "Hl7NotificationRouter",
    entry: "hl7-notification-router",
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
    },
    waitTime: waitTimeHl7NotificationRouter,
  };

  return {
    hl7NotificationRouter,
  };
}

interface Hl7NotificationRouterNestedStackProps extends NestedStackProps {
  config: EnvConfig;
  vpc: ec2.IVpc;
  alarmAction?: SnsAction;
  lambdaLayers: LambdaLayers;
  outgoingHl7NotificationBucket: s3.Bucket;
}

export class Hl7NotificationRouterNestedStack extends NestedStack {
  public readonly lambda: Lambda;

  constructor(scope: Construct, id: string, props: Hl7NotificationRouterNestedStackProps) {
    super(scope, id, props);

    this.terminationProtection = true;

    const setup = this.setupHl7NotificationRouterLambda({
      lambdaLayers: props.lambdaLayers,
      vpc: props.vpc,
      envType: props.config.environmentType,
      sentryDsn: props.config.lambdasSentryDSN,
      alarmAction: props.alarmAction,
      outgoingHl7NotificationBucket: props.outgoingHl7NotificationBucket,
    });

    this.lambda = setup.lambda;
  }

  private setupHl7NotificationRouterLambda(ownProps: {
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
    } = settings().hl7NotificationRouter;

    const queue = createQueue({
      ...queueSettings,
      name,
      stack: this,
      fifo: true,
      createDLQ: true,
      lambdaLayers: [lambdaLayers.shared],
      envType,
      alarmSnsAction: alarmAction,
      maxMessageCountAlarmThreshold: 5_000,
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

    new CfnOutput(this, "Hl7NotificationRouterQueueArn", {
      description: "HL7 Message Router Queue ARN",
      value: queue.queueArn,
      exportName: "Hl7NotificationRouterQueueArn",
    });
    new CfnOutput(this, "Hl7NotificationRouterQueueUrl", {
      description: "HL7 Message Router Queue URL",
      value: queue.queueUrl,
      exportName: "Hl7NotificationRouterQueueUrl",
    });

    return { lambda };
  }
}
