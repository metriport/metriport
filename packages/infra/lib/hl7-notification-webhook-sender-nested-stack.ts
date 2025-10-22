import { CfnOutput, Duration, NestedStack, NestedStackProps } from "aws-cdk-lib";
import { SnsAction } from "aws-cdk-lib/aws-cloudwatch-actions";
import * as dynamodb from "aws-cdk-lib/aws-dynamodb";
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
import { Secrets } from "./shared/secrets";
import { ISecret } from "aws-cdk-lib/aws-secretsmanager";
import { createHieConfigDictionary } from "./shared/hie-config-dictionary";
import { HieConfig, VpnlessHieConfig } from "@metriport/core/command/hl7v2-subscriptions/types";

function settings() {
  const timeout = Duration.seconds(61);
  const hl7NotificationWebhookSender: Omit<QueueAndLambdaSettings, "waitTime"> = {
    name: "Hl7NotificationWebhookSender",
    entry: "hl7-notification-webhook-sender",
    lambda: {
      memory: 1024 as const,
      timeout,
    },
    queue: {
      alarmMaxAgeOfOldestMessage: Duration.minutes(5),
      maxReceiveCount: 3,
      maxMessageCountAlarmThreshold: 1_000,
      visibilityTimeout: Duration.seconds(timeout.toSeconds() * 2 + 1),
      createRetryLambda: false,
    },
    eventSource: {
      batchSize: 1,
      reportBatchItemFailures: true,
      maxConcurrency: 20,
    },
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
  outgoingHl7NotificationBucket: s3.IBucket;
  hl7ConversionBucket: s3.IBucket;
  incomingHl7NotificationBucket: s3.IBucket | undefined;
  secrets: Secrets;
  outboundRateLimitTable: dynamodb.Table;
}

export class Hl7NotificationWebhookSenderNestedStack extends NestedStack {
  public readonly lambda: Lambda;

  constructor(scope: Construct, id: string, props: Hl7NotificationWebhookSenderNestedStackProps) {
    super(scope, id, props);

    this.terminationProtection = true;

    const analyticsSecret = props.secrets["POST_HOG_API_KEY_SECRET"];
    if (!analyticsSecret) {
      throw new Error("Analytics secret is required");
    }

    const hl7Base64ScramblerSeed = props.secrets["HL7_BASE64_SCRAMBLER_SEED"];
    if (!hl7Base64ScramblerSeed) {
      throw new Error("HL7 base64 scrambler seed is undefined");
    }
    const hieConfigs = props.config.hl7Notification?.hieConfigs;
    if (!hieConfigs) {
      throw new Error("HIE configs are undefined");
    }
    const heartbeatMonitorMap = Object.fromEntries(
      Object.values(hieConfigs)
        .filter((hieConfig): hieConfig is HieConfig & { checklyPingUrl: string } =>
          Boolean(hieConfig.checklyPingUrl)
        )
        .map(hieConfig => [hieConfig.name, hieConfig.checklyPingUrl])
    );

    const setup = this.setupHl7NotificationWebhookSenderLambda({
      lambdaLayers: props.lambdaLayers,
      vpc: props.vpc,
      envType: props.config.environmentType,
      sentryDsn: props.config.lambdasSentryDSN,
      alarmAction: props.alarmAction,
      outgoingHl7NotificationBucket: props.outgoingHl7NotificationBucket,
      hl7ConversionBucket: props.hl7ConversionBucket,
      incomingHl7NotificationBucket: props.incomingHl7NotificationBucket,
      analyticsSecret,
      hieConfigs,
      hl7Base64ScramblerSeed,
      heartbeatMonitorMap,
      outboundRateLimitTable: props.outboundRateLimitTable,
    });

    this.lambda = setup.lambda;
  }

  private setupHl7NotificationWebhookSenderLambda(ownProps: {
    lambdaLayers: LambdaLayers;
    vpc: ec2.IVpc;
    envType: EnvType;
    sentryDsn: string | undefined;
    alarmAction: SnsAction | undefined;
    outgoingHl7NotificationBucket: s3.IBucket;
    hl7ConversionBucket: s3.IBucket;
    incomingHl7NotificationBucket: s3.IBucket | undefined;
    analyticsSecret: ISecret;
    hl7Base64ScramblerSeed: ISecret;
    hieConfigs: Record<string, HieConfig | VpnlessHieConfig>;
    heartbeatMonitorMap: Record<string, string>;
    outboundRateLimitTable: dynamodb.Table;
  }): { lambda: Lambda } {
    const {
      lambdaLayers,
      vpc,
      sentryDsn,
      envType,
      alarmAction,
      outgoingHl7NotificationBucket,
      hl7ConversionBucket,
      analyticsSecret,
      hieConfigs,
      incomingHl7NotificationBucket,
      hl7Base64ScramblerSeed,
      heartbeatMonitorMap,
      outboundRateLimitTable,
    } = ownProps;
    const {
      name,
      entry,
      lambda: lambdaSettings,
      queue: queueSettings,
      eventSource: eventSourceSettings,
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

    if (!incomingHl7NotificationBucket) {
      throw new Error("Incoming HL7 notification bucket is undefined");
    }

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
        HL7_OUTGOING_MESSAGE_BUCKET_NAME: outgoingHl7NotificationBucket.bucketName,
        HL7_CONVERSION_BUCKET_NAME: hl7ConversionBucket.bucketName,
        HL7_INCOMING_MESSAGE_BUCKET_NAME: incomingHl7NotificationBucket.bucketName,
        HL7_BASE64_SCRAMBLER_SEED_ARN: hl7Base64ScramblerSeed.secretArn,
        OUTBOUND_RATE_LIMIT_TABLE_NAME: outboundRateLimitTable.tableName,
        ...(sentryDsn ? { SENTRY_DSN: sentryDsn } : {}),
        HIE_CONFIG_DICTIONARY: JSON.stringify(createHieConfigDictionary(hieConfigs)),
        POST_HOG_API_KEY_SECRET: analyticsSecret.secretArn,
        HEARTBEAT_MONITOR_MAP: JSON.stringify(heartbeatMonitorMap),
      },
    });

    outgoingHl7NotificationBucket.grantReadWrite(lambda);
    hl7ConversionBucket.grantReadWrite(lambda);
    incomingHl7NotificationBucket.grantReadWrite(lambda);
    hl7Base64ScramblerSeed.grantRead(lambda);
    outboundRateLimitTable.grantReadWriteData(lambda);

    lambda.addEventSource(new SqsEventSource(queue, eventSourceSettings));
    analyticsSecret.grantRead(lambda);

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
