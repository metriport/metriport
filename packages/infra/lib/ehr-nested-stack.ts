import { Duration, NestedStack, NestedStackProps } from "aws-cdk-lib";
import { SnsAction } from "aws-cdk-lib/aws-cloudwatch-actions";
import * as ec2 from "aws-cdk-lib/aws-ec2";
import { Function as Lambda } from "aws-cdk-lib/aws-lambda";
import { SqsEventSource } from "aws-cdk-lib/aws-lambda-event-sources";
import * as s3 from "aws-cdk-lib/aws-s3";
import { Queue } from "aws-cdk-lib/aws-sqs";
import { Construct } from "constructs";
import { EnvConfig } from "../config/env-config";
import { EnvType } from "./env-type";
import { createLambda } from "./shared/lambda";
import { LambdaLayers } from "./shared/lambda-layers";
import { QueueAndLambdaSettings } from "./shared/settings";
import { createQueue } from "./shared/sqs";

const waitTimePatientSync = Duration.seconds(10); // 6 patients/min
const waitTimeElationLinkPatient = Duration.seconds(10); // 6 patients/min
const waitTimeHealthieLinkPatient = Duration.seconds(10); // 6 patients/min
const waitTimeComputeResourceDiff = Duration.millis(0); // No limit
const waitTimeRefreshBundle = Duration.seconds(10); // 6 patients/min

function settings(): {
  syncPatient: QueueAndLambdaSettings;
  elationLinkPatient: QueueAndLambdaSettings;
  healthieLinkPatient: QueueAndLambdaSettings;
  computeResourceDiffBundles: QueueAndLambdaSettings;
  refreshEhrBundles: QueueAndLambdaSettings;
} {
  const syncPatientLambdaTimeout = waitTimePatientSync.plus(Duration.seconds(25));
  const syncPatient: QueueAndLambdaSettings = {
    name: "EhrSyncPatient",
    entry: "ehr-sync-patient",
    lambda: {
      memory: 512,
      timeout: syncPatientLambdaTimeout,
    },
    queue: {
      alarmMaxAgeOfOldestMessage: Duration.hours(6),
      maxMessageCountAlarmThreshold: 5_000,
      maxReceiveCount: 3,
      visibilityTimeout: Duration.seconds(syncPatientLambdaTimeout.toSeconds() * 2 + 1),
      createRetryLambda: false,
    },
    eventSource: {
      batchSize: 1,
      reportBatchItemFailures: true,
    },
    waitTime: waitTimePatientSync,
  };
  const elationLinkPatientLambdaTimeout = waitTimeElationLinkPatient.plus(Duration.seconds(25));
  const elationLinkPatient: QueueAndLambdaSettings = {
    name: "EhrElationLinkPatient",
    entry: "elation-link-patient",
    lambda: {
      memory: 512,
      timeout: elationLinkPatientLambdaTimeout,
    },
    queue: {
      alarmMaxAgeOfOldestMessage: Duration.hours(6),
      maxMessageCountAlarmThreshold: 5_000,
      maxReceiveCount: 3,
      visibilityTimeout: Duration.seconds(elationLinkPatientLambdaTimeout.toSeconds() * 2 + 1),
      createRetryLambda: false,
    },
    eventSource: {
      batchSize: 1,
      reportBatchItemFailures: true,
    },
    waitTime: waitTimeElationLinkPatient,
  };
  const healthieLinkPatientLambdaTimeout = waitTimeHealthieLinkPatient.plus(Duration.seconds(25));
  const healthieLinkPatient: QueueAndLambdaSettings = {
    name: "EhrHealthieLinkPatient",
    entry: "healthie-link-patient",
    lambda: {
      memory: 512,
      timeout: healthieLinkPatientLambdaTimeout,
    },
    queue: {
      alarmMaxAgeOfOldestMessage: Duration.hours(6),
      maxMessageCountAlarmThreshold: 5_000,
      maxReceiveCount: 3,
      visibilityTimeout: Duration.seconds(healthieLinkPatientLambdaTimeout.toSeconds() * 2 + 1),
      createRetryLambda: false,
    },
    eventSource: {
      batchSize: 1,
      reportBatchItemFailures: true,
    },
    waitTime: waitTimeHealthieLinkPatient,
  };
  // Skip adding the wait time to the lambda timeout because it's already sub 1 second
  const computeResourceDiffBundlesLambdaTimeout = Duration.minutes(12);
  const computeResourceDiffBundles: QueueAndLambdaSettings = {
    name: "EhrComputeResourceDiffBundles",
    entry: "ehr-compute-resource-diff-bundles",
    lambda: {
      memory: 1024,
      timeout: computeResourceDiffBundlesLambdaTimeout,
    },
    queue: {
      alarmMaxAgeOfOldestMessage: Duration.hours(2),
      maxMessageCountAlarmThreshold: 15_000,
      maxReceiveCount: 3,
      visibilityTimeout: Duration.seconds(
        computeResourceDiffBundlesLambdaTimeout.toSeconds() * 2 + 1
      ),
      createRetryLambda: false,
    },
    eventSource: {
      batchSize: 1,
      reportBatchItemFailures: true,
      maxConcurrency: 10,
    },
    waitTime: waitTimeComputeResourceDiff,
  };
  const refreshEhrBundlesLambdaTimeout = waitTimeRefreshBundle.plus(Duration.minutes(10));
  const refreshEhrBundles: QueueAndLambdaSettings = {
    name: "EhrRefreshEhrBundles",
    entry: "ehr-refresh-ehr-bundles",
    lambda: {
      memory: 1024,
      timeout: refreshEhrBundlesLambdaTimeout,
    },
    queue: {
      alarmMaxAgeOfOldestMessage: Duration.hours(2),
      maxMessageCountAlarmThreshold: 1_000,
      maxReceiveCount: 3,
      visibilityTimeout: Duration.seconds(refreshEhrBundlesLambdaTimeout.toSeconds() * 2 + 1),
      createRetryLambda: false,
    },
    eventSource: {
      batchSize: 1,
      reportBatchItemFailures: true,
    },
    waitTime: waitTimeRefreshBundle,
  };
  return {
    syncPatient,
    elationLinkPatient,
    healthieLinkPatient,
    computeResourceDiffBundles,
    refreshEhrBundles,
  };
}

interface EhrNestedStackProps extends NestedStackProps {
  config: EnvConfig;
  vpc: ec2.IVpc;
  alarmAction?: SnsAction;
  lambdaLayers: LambdaLayers;
}

export class EhrNestedStack extends NestedStack {
  readonly syncPatientLambda: Lambda;
  readonly syncPatientQueue: Queue;
  readonly elationLinkPatientLambda: Lambda;
  readonly elationLinkPatientQueue: Queue;
  readonly healthieLinkPatientLambda: Lambda;
  readonly healthieLinkPatientQueue: Queue;
  readonly computeResourceDiffBundlesLambda: Lambda;
  readonly computeResourceDiffBundlesQueue: Queue;
  readonly refreshEhrBundlesLambda: Lambda;
  readonly refreshEhrBundlesQueue: Queue;
  readonly ehrBundleBucket: s3.Bucket;

  constructor(scope: Construct, id: string, props: EhrNestedStackProps) {
    super(scope, id, props);

    this.terminationProtection = true;

    const ehrBundleBucket = new s3.Bucket(this, "EhrBundleBucket", {
      bucketName: props.config.ehrBundleBucketName,
      publicReadAccess: false,
      encryption: s3.BucketEncryption.S3_MANAGED,
      versioned: true,
      cors: [
        {
          allowedOrigins: ["*"],
          allowedMethods: [s3.HttpMethods.GET],
        },
      ],
    });
    this.ehrBundleBucket = ehrBundleBucket;

    const syncPatient = this.setupSyncPatient({
      lambdaLayers: props.lambdaLayers,
      vpc: props.vpc,
      envType: props.config.environmentType,
      sentryDsn: props.config.lambdasSentryDSN,
      alarmAction: props.alarmAction,
    });
    this.syncPatientLambda = syncPatient.lambda;
    this.syncPatientQueue = syncPatient.queue;

    const elationLinkPatient = this.setupElationLinkPatient({
      lambdaLayers: props.lambdaLayers,
      vpc: props.vpc,
      envType: props.config.environmentType,
      sentryDsn: props.config.lambdasSentryDSN,
      alarmAction: props.alarmAction,
    });
    this.elationLinkPatientLambda = elationLinkPatient.lambda;
    this.elationLinkPatientQueue = elationLinkPatient.queue;

    const healthieLinkPatient = this.setupHealthieLinkPatient({
      lambdaLayers: props.lambdaLayers,
      vpc: props.vpc,
      envType: props.config.environmentType,
      sentryDsn: props.config.lambdasSentryDSN,
      alarmAction: props.alarmAction,
    });
    this.healthieLinkPatientLambda = healthieLinkPatient.lambda;
    this.healthieLinkPatientQueue = healthieLinkPatient.queue;

    const computeResourceDiffBundles = this.setupComputeResourceDiffBundles({
      lambdaLayers: props.lambdaLayers,
      vpc: props.vpc,
      envType: props.config.environmentType,
      sentryDsn: props.config.lambdasSentryDSN,
      alarmAction: props.alarmAction,
      ehrBundleBucket: this.ehrBundleBucket,
    });
    this.computeResourceDiffBundlesLambda = computeResourceDiffBundles.lambda;
    this.computeResourceDiffBundlesQueue = computeResourceDiffBundles.queue;

    const refreshEhrBundles = this.setupRefreshEhrBundles({
      lambdaLayers: props.lambdaLayers,
      vpc: props.vpc,
      envType: props.config.environmentType,
      sentryDsn: props.config.lambdasSentryDSN,
      alarmAction: props.alarmAction,
      ehrBundleBucket: this.ehrBundleBucket,
      computeResourceDiffBundlesQueue: this.computeResourceDiffBundlesQueue,
    });
    this.refreshEhrBundlesLambda = refreshEhrBundles.lambda;
    this.refreshEhrBundlesQueue = refreshEhrBundles.queue;
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
      lambda: lambdaSettings,
      queue: queueSettings,
      eventSource: eventSourceSettings,
      waitTime,
    } = settings().syncPatient;

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
      vpc,
      alarmSnsAction: alarmAction,
    });

    lambda.addEventSource(new SqsEventSource(queue, eventSourceSettings));

    return { lambda, queue };
  }

  private setupElationLinkPatient(ownProps: {
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
      lambda: lambdaSettings,
      queue: queueSettings,
      eventSource: eventSourceSettings,
      waitTime,
    } = settings().elationLinkPatient;

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
      vpc,
      alarmSnsAction: alarmAction,
    });

    lambda.addEventSource(new SqsEventSource(queue, eventSourceSettings));

    return { lambda, queue };
  }

  private setupHealthieLinkPatient(ownProps: {
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
      lambda: lambdaSettings,
      queue: queueSettings,
      eventSource: eventSourceSettings,
      waitTime,
    } = settings().healthieLinkPatient;

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
      vpc,
      alarmSnsAction: alarmAction,
    });

    lambda.addEventSource(new SqsEventSource(queue, eventSourceSettings));

    return { lambda, queue };
  }

  private setupComputeResourceDiffBundles(ownProps: {
    lambdaLayers: LambdaLayers;
    vpc: ec2.IVpc;
    envType: EnvType;
    sentryDsn: string | undefined;
    alarmAction: SnsAction | undefined;
    ehrBundleBucket: s3.Bucket;
  }): { lambda: Lambda; queue: Queue } {
    const { lambdaLayers, vpc, envType, sentryDsn, alarmAction } = ownProps;
    const {
      name,
      entry,
      lambda: lambdaSettings,
      queue: queueSettings,
      eventSource: eventSourceSettings,
      waitTime,
    } = settings().computeResourceDiffBundles;

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
      stack: this,
      name,
      entry,
      envType,
      envVars: {
        // API_URL set on the api-stack after the OSS API is created
        WAIT_TIME_IN_MILLIS: waitTime.toMilliseconds().toString(),
        MAX_ATTEMPTS: queueSettings.maxReceiveCount.toString(),
        EHR_BUNDLE_BUCKET_NAME: ownProps.ehrBundleBucket.bucketName,
        ...(sentryDsn ? { SENTRY_DSN: sentryDsn } : {}),
      },
      layers: [lambdaLayers.shared],
      vpc,
      alarmSnsAction: alarmAction,
    });

    lambda.addEventSource(new SqsEventSource(queue, eventSourceSettings));

    // Grant read to medical document bucket set on the api-stack
    ownProps.ehrBundleBucket.grantWrite(lambda);

    return { lambda, queue };
  }

  private setupRefreshEhrBundles(ownProps: {
    lambdaLayers: LambdaLayers;
    vpc: ec2.IVpc;
    envType: EnvType;
    sentryDsn: string | undefined;
    alarmAction: SnsAction | undefined;
    ehrBundleBucket: s3.Bucket;
    computeResourceDiffBundlesQueue: Queue;
  }): { lambda: Lambda; queue: Queue } {
    const { lambdaLayers, vpc, envType, sentryDsn, alarmAction } = ownProps;
    const {
      name,
      entry,
      lambda: lambdaSettings,
      queue: queueSettings,
      eventSource: eventSourceSettings,
      waitTime,
    } = settings().refreshEhrBundles;

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
      vpc,
      alarmSnsAction: alarmAction,
    });

    lambda.addEventSource(new SqsEventSource(queue, eventSourceSettings));

    ownProps.ehrBundleBucket.grantWrite(lambda);
    ownProps.computeResourceDiffBundlesQueue.grantSendMessages(lambda);

    return { lambda, queue };
  }
}
