import { Duration, NestedStack, NestedStackProps } from "aws-cdk-lib";
import { SnsAction } from "aws-cdk-lib/aws-cloudwatch-actions";
import * as ec2 from "aws-cdk-lib/aws-ec2";
import { Function as Lambda } from "aws-cdk-lib/aws-lambda";
import { SqsEventSource } from "aws-cdk-lib/aws-lambda-event-sources";
import { ISecret } from "aws-cdk-lib/aws-secretsmanager";
import { Queue } from "aws-cdk-lib/aws-sqs";
import { Construct } from "constructs";
import { EnvConfig } from "../config/env-config";
import { EnvType } from "./env-type";
import { createLambda } from "./shared/lambda";
import { LambdaLayers } from "./shared/lambda-layers";
import { Secrets } from "./shared/secrets";
import { QueueAndLambdaSettings } from "./shared/settings";
import { createQueue } from "./shared/sqs";

const waitTimeDischargeRequery = Duration.seconds(10);

function settings() {
  const timeout = waitTimeDischargeRequery.plus(Duration.seconds(30));
  const dischargeRequery: QueueAndLambdaSettings = {
    name: "DischargeRequery",
    entry: "patient-monitoring/discharge-requery",
    lambda: {
      memory: 512,
      timeout,
    },
    queue: {
      alarmMaxAgeOfOldestMessage: Duration.minutes(5),
      maxMessageCountAlarmThreshold: 500,
      maxReceiveCount: 3,
      visibilityTimeout: Duration.seconds(timeout.toSeconds() * 2 + 1),
      createRetryLambda: false,
    },
    eventSource: {
      batchSize: 1,
      reportBatchItemFailures: true,
    },
    waitTime: waitTimeDischargeRequery,
  };

  return {
    dischargeRequery,
  };
}

interface PatientMonitoringNestedStackProps extends NestedStackProps {
  config: EnvConfig;
  vpc: ec2.IVpc;
  alarmAction?: SnsAction;
  lambdaLayers: LambdaLayers;
  secrets: Secrets;
}

export class PatientMonitoringNestedStack extends NestedStack {
  public readonly dischargeRequeryLambda: Lambda;
  public readonly dischargeRequeryQueue: Queue;

  constructor(scope: Construct, id: string, props: PatientMonitoringNestedStackProps) {
    super(scope, id, props);

    this.terminationProtection = true;

    const analyticsSecret = props.secrets["POST_HOG_API_KEY_SECRET"];
    if (!analyticsSecret) {
      throw new Error("Analytics secret is required");
    }

    const dischargeRequery = this.setupDischargeRequery({
      lambdaLayers: props.lambdaLayers,
      vpc: props.vpc,
      envType: props.config.environmentType,
      sentryDsn: props.config.lambdasSentryDSN,
      alarmAction: props.alarmAction,
      analyticsSecret,
    });

    this.dischargeRequeryLambda = dischargeRequery.lambda;
    this.dischargeRequeryQueue = dischargeRequery.queue;
  }

  private setupDischargeRequery(ownProps: {
    lambdaLayers: LambdaLayers;
    vpc: ec2.IVpc;
    envType: EnvType;
    sentryDsn: string | undefined;
    alarmAction: SnsAction | undefined;
    analyticsSecret: ISecret;
  }): { lambda: Lambda; queue: Queue } {
    const { lambdaLayers, vpc, sentryDsn, envType, alarmAction, analyticsSecret } = ownProps;
    const {
      name,
      entry,
      eventSource: eventSourceSettings,
      lambda: lambdaSettings,
      queue: queueSettings,
    } = settings().dischargeRequery;

    const queue = createQueue({
      ...queueSettings,
      stack: this,
      name,
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
        DISCHARGE_REQUERY_QUEUE_URL: queue.queueUrl,
        WAIT_TIME_IN_MILLIS: waitTimeDischargeRequery.toMilliseconds().toString(),
        MAX_ATTEMPTS: queueSettings.maxReceiveCount.toString(),
        ...(sentryDsn ? { SENTRY_DSN: sentryDsn } : {}),
      },
    });

    lambda.addEventSource(new SqsEventSource(queue, eventSourceSettings));
    analyticsSecret.grantRead(lambda);

    return { lambda, queue };
  }
}
