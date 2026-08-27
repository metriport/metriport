import { Duration, NestedStack, NestedStackProps } from "aws-cdk-lib";
import { SnsAction } from "aws-cdk-lib/aws-cloudwatch-actions";
import * as ec2 from "aws-cdk-lib/aws-ec2";
import { Function as Lambda } from "aws-cdk-lib/aws-lambda";
import { SqsEventSource } from "aws-cdk-lib/aws-lambda-event-sources";
import { ISecret } from "aws-cdk-lib/aws-secretsmanager";
import { Queue } from "aws-cdk-lib/aws-sqs";
import { Construct } from "constructs";
import { EnvConfig } from "../../config/env-config";
import { EnvType } from "../env-type";
import { createLambda } from "../shared/lambda";
import { LambdaLayers } from "../shared/lambda-layers";
import { Secrets } from "../shared/secrets";
import { QueueAndLambdaSettings } from "../shared/settings";
import { createQueue, provideAccessToQueue } from "../shared/sqs";

const waitTimeDischargeRequery = Duration.seconds(10);

function settings() {
  const dischargeRequeryTimeout = waitTimeDischargeRequery.plus(Duration.seconds(30));
  const dischargeRequery: QueueAndLambdaSettings = {
    name: "DischargeRequery",
    entry: "patient-monitoring/discharge-requery",
    lambda: {
      memory: 512,
      timeout: dischargeRequeryTimeout,
    },
    queue: {
      alertMaxApproximateAgeOfOldestMessage: Duration.minutes(5),
      alertMaxApproximateNumberOfMessagesVisible: 500,
      maxReceiveCount: 3,
      visibilityTimeout: Duration.seconds(dischargeRequeryTimeout.toSeconds() * 2 + 1),
      createRetryLambda: false,
    },
    eventSource: {
      batchSize: 1,
      reportBatchItemFailures: true,
    },
    waitTime: waitTimeDischargeRequery,
  };

  const scheduledQueriesTimeout = Duration.minutes(15);
  const scheduledQueries: QueueAndLambdaSettings = {
    name: "ScheduledQueries",
    entry: "patient-monitoring/scheduled-queries",
    lambda: {
      memory: 1024,
      timeout: scheduledQueriesTimeout,
    },
    queue: {
      alertMaxApproximateAgeOfOldestMessage: Duration.minutes(180),
      maxReceiveCount: 3,
      visibilityTimeout: Duration.seconds(scheduledQueriesTimeout.toSeconds() * 2 + 1),
      createRetryLambda: false,
    },
    eventSource: {
      batchSize: 1,
      reportBatchItemFailures: true,
    },
    waitTime: Duration.seconds(0),
  };

  return {
    dischargeRequery,
    scheduledQueries,
  };
}

interface PatientMonitoringNestedStackProps extends NestedStackProps {
  config: EnvConfig;
  vpc: ec2.IVpc;
  alertAction?: SnsAction;
  documentQueryQueue: Queue;
  lambdaLayers: LambdaLayers;
  secrets: Secrets;
}

export class PatientMonitoringNestedStack extends NestedStack {
  public readonly dischargeRequeryLambda: Lambda | undefined;
  public readonly dischargeRequeryQueue: Queue | undefined;
  public readonly scheduledQueriesLambda: Lambda;
  public readonly scheduledQueriesQueue: Queue;

  constructor(scope: Construct, id: string, props: PatientMonitoringNestedStackProps) {
    super(scope, id, props);

    this.terminationProtection = true;

    const analyticsSecret = props.secrets["POST_HOG_API_KEY_SECRET"];
    if (!analyticsSecret) {
      throw new Error("Analytics secret is required");
    }

    if (props.config.hl7Notification) {
      const dischargeRequery = this.setupDischargeRequery({
        lambdaLayers: props.lambdaLayers,
        vpc: props.vpc,
        envType: props.config.environmentType,
        sentryDsn: props.config.lambdasSentryDSN,
        alertAction: props.alertAction,
        analyticsSecret,
      });
      this.dischargeRequeryLambda = dischargeRequery.lambda;
      this.dischargeRequeryQueue = dischargeRequery.queue;
    }

    const { lambda: scheduledQueriesLambda, queue: scheduledQueriesQueue } =
      this.setupScheduledQueries({
        lambdaLayers: props.lambdaLayers,
        sentryDsn: props.config.lambdasSentryDSN,
        vpc: props.vpc,
        envType: props.config.environmentType,
        alertAction: props.alertAction,
        documentQueryQueue: props.documentQueryQueue,
      });
    this.scheduledQueriesLambda = scheduledQueriesLambda;
    this.scheduledQueriesQueue = scheduledQueriesQueue;
  }

  private setupDischargeRequery(ownProps: {
    lambdaLayers: LambdaLayers;
    vpc: ec2.IVpc;
    envType: EnvType;
    sentryDsn: string | undefined;
    alertAction: SnsAction | undefined;
    analyticsSecret: ISecret;
  }): { lambda: Lambda; queue: Queue } {
    const { lambdaLayers, vpc, sentryDsn, envType, alertAction, analyticsSecret } = ownProps;
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
      alertSnsAction: alertAction,
    });

    const lambda = createLambda({
      ...lambdaSettings,
      name,
      entry,
      stack: this,
      envType,
      layers: [lambdaLayers.shared],
      vpc,
      alertSnsAction: alertAction,
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

  private setupScheduledQueries(ownProps: {
    lambdaLayers: LambdaLayers;
    vpc: ec2.IVpc;
    envType: EnvType;
    sentryDsn: string | undefined;
    alertAction: SnsAction | undefined;
    documentQueryQueue: Queue;
  }): { lambda: Lambda; queue: Queue } {
    const { lambdaLayers, vpc, sentryDsn, envType, alertAction, documentQueryQueue } = ownProps;
    const {
      name,
      entry,
      eventSource: eventSourceSettings,
      lambda: lambdaSettings,
      queue: queueSettings,
    } = settings().scheduledQueries;
    const queue = createQueue({
      ...queueSettings,
      stack: this,
      name,
      fifo: true,
      createDLQ: true,
      lambdaLayers: [lambdaLayers.shared],
      envType,
      alertSnsAction: alertAction,
    });

    /**
     * Lambda that executes patient monitoring for a specific customer and cadences.
     * This lambda consumes messages from the queue sent by the orchestrator endpoint.
     */
    const lambda = createLambda({
      ...lambdaSettings,
      stack: this,
      name,
      entry,
      envType,
      envVars: {
        // API_URL will be set in api-stack after load balancer is created
        DOCUMENT_QUERY_QUEUE_URL: documentQueryQueue.queueUrl,
        ...(sentryDsn ? { SENTRY_DSN: sentryDsn } : {}),
      },
      layers: [lambdaLayers.shared],
      vpc,
      alertSnsAction: alertAction,
    });

    lambda.addEventSource(new SqsEventSource(queue, eventSourceSettings));

    provideAccessToQueue({
      accessType: "send",
      queue: documentQueryQueue,
      resource: lambda,
    });

    return { lambda, queue };
  }
}
