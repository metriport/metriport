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
import { createQueue } from "./shared/sqs";
import { QueueAndLambdaSettings } from "./shared/settings";

const waitTimePatientSync = Duration.seconds(10); // 6 patients/min
const waitTimeElationLinkPatient = Duration.seconds(1); // 60 patients/min
const waitTimeStartResourceDiff = Duration.seconds(10); // 6 patients/min
const waitTimeComputeResourceDiff = Duration.seconds(1); // 60 patients/min
const waitTimeRefreshBundle = Duration.seconds(10); // 6 patients/min

function settings(): {
  syncPatient: QueueAndLambdaSettings;
  elationLinkPatient: QueueAndLambdaSettings;
} {
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
      alarmMaxAgeOfOldestMessage: Duration.hours(2),
      maxMessageCountAlarmThreshold: 5_000,
      maxReceiveCount: 3,
      visibilityTimeout: Duration.seconds(syncPatientLambdaTimeout.toSeconds() * 2 + 1),
      createRetryLambda: false,
    },
    waitTime: waitTimePatientSync,
  };
  const elationLinkPatientLambdaTimeout = waitTimeElationLinkPatient.plus(Duration.seconds(25));
  const elationLinkPatient: QueueAndLambdaSettings = {
    name: "EhrElationLinkPatient",
    entry: "elation-link-patient",
    lambda: {
      memory: 1024,
      batchSize: 1,
      timeout: elationLinkPatientLambdaTimeout,
      reportBatchItemFailures: true,
    },
    queue: {
      alarmMaxAgeOfOldestMessage: Duration.hours(2),
      maxMessageCountAlarmThreshold: 5_000,
      maxReceiveCount: 3,
      visibilityTimeout: Duration.seconds(elationLinkPatientLambdaTimeout.toSeconds() * 2 + 1),
      createRetryLambda: false,
    },
    waitTime: waitTimeElationLinkPatient,
  };
  const startResourceDiffLambdaTimeout = waitTimeStartResourceDiff.plus(Duration.minutes(2));
  const startResourceDiff: QueueAndLambdaSettings = {
    name: "EhrStartResourceDiff",
    entry: "ehr-start-resource-diff",
    lambda: {
      memory: 1024,
      batchSize: 1,
      timeout: startResourceDiffLambdaTimeout,
      reportBatchItemFailures: true,
    },
    queue: {
      alarmMaxAgeOfOldestMessage: Duration.hours(2),
      maxMessageCountAlarmThreshold: 5_000,
      maxReceiveCount: 3,
      visibilityTimeout: Duration.seconds(startResourceDiffLambdaTimeout.toSeconds() * 2 + 1),
      createRetryLambda: false,
    },
    waitTime: waitTimeStartResourceDiff,
  };
  const ComputeResourceDiffLambdaTimeout = waitTimeComputeResourceDiff.plus(Duration.minutes(5));
  const computeResourceDiff: QueueAndLambdaSettings = {
    name: "EhrComputeResourceDiff",
    entry: "ehr-compute-resource-diff",
    lambda: {
      memory: 1024,
      batchSize: 1,
      timeout: ComputeResourceDiffLambdaTimeout,
      reportBatchItemFailures: true,
    },
    queue: {
      alarmMaxAgeOfOldestMessage: Duration.hours(2),
      maxMessageCountAlarmThreshold: 15_000,
      maxReceiveCount: 3,
      visibilityTimeout: Duration.seconds(ComputeResourceDiffLambdaTimeout.toSeconds() * 2 + 1),
      createRetryLambda: false,
    },
    waitTime: waitTimeComputeResourceDiff,
  };
  const RefreshBundleLambdaTimeout = waitTimeRefreshBundle.plus(Duration.minutes(5));
  const refreshBundle: QueueAndLambdaSettings = {
    name: "EhrRefreshBundle",
    entry: "ehr-refresh-bundle",
    lambda: {
      memory: 1024,
      batchSize: 1,
      timeout: RefreshBundleLambdaTimeout,
      reportBatchItemFailures: true,
    },
    queue: {
      alarmMaxAgeOfOldestMessage: Duration.hours(2),
      maxMessageCountAlarmThreshold: 15_000,
      maxReceiveCount: 3,
      visibilityTimeout: Duration.seconds(RefreshBundleLambdaTimeout.toSeconds() * 2 + 1),
      createRetryLambda: false,
    },
    waitTime: waitTimeRefreshBundle,
  };
  return {
    syncPatient,
    elationLinkPatient,
    startResourceDiff,
    computeResourceDiff,
    refreshBundle,
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
  readonly startResourceDiffLambda: Lambda;
  readonly startResourceDiffQueue: Queue;
  readonly computeResourceDiffLambda: Lambda;
  readonly computeResourceDiffQueue: Queue;
  readonly refreshBundleLambda: Lambda;
  readonly refreshBundleQueue: Queue;
  readonly ehrBundleBucket: s3.Bucket;

  constructor(scope: Construct, id: string, props: EhrNestedStackProps) {
    super(scope, id, props);

    this.terminationProtection = true;

    const ehrBundleBucket = new s3.Bucket(this, "EhrBundleBucket", {
      bucketName: props.config.ehrBundleBucketName,
      publicReadAccess: false,
      encryption: s3.BucketEncryption.S3_MANAGED,
      versioned: true,
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

    const computeResourceDiff = this.setupComputeResourceDiff({
      lambdaLayers: props.lambdaLayers,
      vpc: props.vpc,
      envType: props.config.environmentType,
      sentryDsn: props.config.lambdasSentryDSN,
      alarmAction: props.alarmAction,
      ehrBundleBucket: this.ehrBundleBucket,
    });
    this.computeResourceDiffLambda = computeResourceDiff.lambda;
    this.computeResourceDiffQueue = computeResourceDiff.queue;

    const startResourceDiff = this.setupStartResourceDiff({
      lambdaLayers: props.lambdaLayers,
      vpc: props.vpc,
      envType: props.config.environmentType,
      sentryDsn: props.config.lambdasSentryDSN,
      alarmAction: props.alarmAction,
      computeResourceDiffQueue: this.computeResourceDiffQueue,
    });
    this.startResourceDiffLambda = startResourceDiff.lambda;
    this.startResourceDiffQueue = startResourceDiff.queue;

    const refreshBundle = this.setupRefreshBundle({
      lambdaLayers: props.lambdaLayers,
      vpc: props.vpc,
      envType: props.config.environmentType,
      sentryDsn: props.config.lambdasSentryDSN,
      alarmAction: props.alarmAction,
    });
    this.refreshBundleLambda = refreshBundle.lambda;
    this.refreshBundleQueue = refreshBundle.queue;
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
      lambda: { memory, timeout, batchSize, reportBatchItemFailures },
      queue: {
        visibilityTimeout,
        maxReceiveCount,
        alarmMaxAgeOfOldestMessage,
        maxMessageCountAlarmThreshold,
        createRetryLambda,
      },
      waitTime,
    } = settings().elationLinkPatient;

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

  private setupStartResourceDiff(ownProps: {
    lambdaLayers: LambdaLayers;
    vpc: ec2.IVpc;
    envType: EnvType;
    sentryDsn: string | undefined;
    alarmAction: SnsAction | undefined;
    computeResourceDiffQueue: Queue;
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
    } = settings().startResourceDiff;

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
        EHR_COMPUTE_RESOURCE_DIFF_QUEUE_URL: ownProps.computeResourceDiffQueue.queueUrl,
        ...(sentryDsn ? { SENTRY_DSN: sentryDsn } : {}),
      },
      layers: [lambdaLayers.shared],
      memory: memory,
      timeout: timeout,
      vpc,
      alarmSnsAction: alarmAction,
    });

    lambda.addEventSource(new SqsEventSource(queue, { batchSize, reportBatchItemFailures }));

    ownProps.computeResourceDiffQueue.grantSendMessages(lambda);

    return { lambda, queue };
  }

  private setupComputeResourceDiff(ownProps: {
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
      lambda: { memory, timeout, batchSize, reportBatchItemFailures },
      queue: {
        visibilityTimeout,
        maxReceiveCount,
        alarmMaxAgeOfOldestMessage,
        maxMessageCountAlarmThreshold,
        createRetryLambda,
      },
      waitTime,
    } = settings().computeResourceDiff;

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
        EHR_BUNDLE_BUCKET_NAME: ownProps.ehrBundleBucket.bucketName,
        ...(sentryDsn ? { SENTRY_DSN: sentryDsn } : {}),
      },
      layers: [lambdaLayers.shared],
      memory: memory,
      timeout: timeout,
      vpc,
      alarmSnsAction: alarmAction,
    });

    lambda.addEventSource(new SqsEventSource(queue, { batchSize, reportBatchItemFailures }));

    ownProps.ehrBundleBucket.grantReadWrite(lambda);

    return { lambda, queue };
  }

  private setupRefreshBundle(ownProps: {
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
    } = settings().refreshBundle;

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
