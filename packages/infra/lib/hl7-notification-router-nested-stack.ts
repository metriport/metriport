import { CfnOutput, Duration, NestedStack, NestedStackProps } from "aws-cdk-lib";
import { SnsAction } from "aws-cdk-lib/aws-cloudwatch-actions";
import * as ec2 from "aws-cdk-lib/aws-ec2";
import { Function as Lambda } from "aws-cdk-lib/aws-lambda";
import { SqsEventSource } from "aws-cdk-lib/aws-lambda-event-sources";
import * as s3 from "aws-cdk-lib/aws-s3";
import { Construct } from "constructs";
import { EnvConfig } from "../config/env-config";
import { EnvType } from "./env-type";
import { createLambda, MAXIMUM_LAMBDA_TIMEOUT } from "./shared/lambda";
import { LambdaLayers } from "./shared/lambda-layers";
import { createQueue } from "./shared/sqs";

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

    const lambdaTimeout = MAXIMUM_LAMBDA_TIMEOUT.minus(Duration.seconds(5));

    const queue = createQueue({
      stack: this,
      name: "Hl7NotificationRouterQueue",
      fifo: true,
      createDLQ: true,
      visibilityTimeout: Duration.seconds(lambdaTimeout.toSeconds() * 2 + 1),
      lambdaLayers: [lambdaLayers.shared],
      envType,
      alarmSnsAction: alarmAction,
      alarmMaxAgeOfOldestMessage: Duration.minutes(5),
      maxMessageCountAlarmThreshold: 5_000,
      createRetryLambda: true,
    });

    const lambda = createLambda({
      stack: this,
      name: "Hl7NotificationRouter",
      entry: "hl7-notification-router",
      envType,
      envVars: {
        // API_URL set on the api-stack after the OSS API is created
        ...(sentryDsn ? { SENTRY_DSN: sentryDsn } : {}),
      },
      layers: [lambdaLayers.shared],
      memory: 1024,
      timeout: lambdaTimeout,
      vpc,
      alarmSnsAction: alarmAction,
    });

    outgoingHl7NotificationBucket.grantReadWrite(lambda);
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
