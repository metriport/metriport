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
import { QueueAndLambdaSettings, LambdaSettings } from "./shared/settings";
import { createQueue } from "./shared/sqs";

const waitTimePatientSync = Duration.seconds(10); // 6 patients/min
const waitTimeElationLinkPatient = Duration.seconds(10); // 6 patients/min
const waitTimeHealthieLinkPatient = Duration.seconds(10); // 6 patients/min
const waitTimeComputeResourceDiff = Duration.millis(0); // No limit
const waitTimeRefreshBundle = Duration.seconds(0); // No limit
const waitTimeContributeResourceDiffBundles = Duration.seconds(0); // No limit
const waitTimeWriteBackResourceDiffBundles = Duration.seconds(0); // No limit

function settings(): {
  getAppointments: LambdaSettings;
  syncPatient: QueueAndLambdaSettings;
  elationLinkPatient: QueueAndLambdaSettings;
  healthieLinkPatient: QueueAndLambdaSettings;
  computeResourceDiffBundles: QueueAndLambdaSettings;
  refreshEhrBundles: QueueAndLambdaSettings;
  contributeResourceDiffBundles: QueueAndLambdaSettings;
  writeBackResourceDiffBundles: QueueAndLambdaSettings;
} {
  const getAppointmentsLambdaTimeout = Duration.minutes(15);
  const getAppointments: LambdaSettings = {
    name: "EhrGetAppointments",
    entry: "ehr/get-appointments",
    lambda: {
      memory: 1024,
      timeout: getAppointmentsLambdaTimeout,
    },
  };
  const syncPatientLambdaTimeout = waitTimePatientSync.plus(Duration.seconds(25));
  const syncPatient: QueueAndLambdaSettings = {
    name: "EhrSyncPatient",
    entry: "ehr/sync-patient",
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
    entry: "ehr/elation/link-patient",
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
    entry: "ehr/healthie/link-patient",
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
  const computeResourceDiffBundlesLambdaTimeout = Duration.minutes(15);
  const computeResourceDiffBundles: QueueAndLambdaSettings = {
    name: "EhrComputeResourceDiffBundles",
    entry: "ehr/compute-resource-diff-bundles",
    lambda: {
      memory: 4096,
      timeout: computeResourceDiffBundlesLambdaTimeout,
    },
    queue: {
      alarmMaxAgeOfOldestMessage: Duration.hours(2),
      maxMessageCountAlarmThreshold: 5_000,
      maxReceiveCount: 3,
      visibilityTimeout: Duration.seconds(
        computeResourceDiffBundlesLambdaTimeout.toSeconds() * 2 + 1
      ),
      createRetryLambda: false,
    },
    eventSource: {
      batchSize: 1,
      reportBatchItemFailures: true,
      maxConcurrency: 4,
    },
    waitTime: waitTimeComputeResourceDiff,
  };
  // Skip adding the wait time to the lambda timeout because it's already sub 1 second
  const refreshEhrBundlesLambdaTimeout = Duration.minutes(15);
  const refreshEhrBundles: QueueAndLambdaSettings = {
    name: "EhrRefreshEhrBundles",
    entry: "ehr/refresh-ehr-bundles",
    lambda: {
      memory: 512,
      timeout: refreshEhrBundlesLambdaTimeout,
    },
    queue: {
      alarmMaxAgeOfOldestMessage: Duration.hours(2),
      maxMessageCountAlarmThreshold: 5_000,
      maxReceiveCount: 3,
      visibilityTimeout: Duration.seconds(refreshEhrBundlesLambdaTimeout.toSeconds() * 2 + 1),
      createRetryLambda: false,
    },
    eventSource: {
      batchSize: 1,
      reportBatchItemFailures: true,
      maxConcurrency: 4,
    },
    waitTime: waitTimeRefreshBundle,
  };
  const contributeResourceDiffBundlesLambdaTimeout = Duration.minutes(15);
  const contributeResourceDiffBundles: QueueAndLambdaSettings = {
    name: "EhrContributeResourceDiffBundles",
    entry: "ehr/contribute-resource-diff-bundles",
    lambda: {
      memory: 4096,
      timeout: contributeResourceDiffBundlesLambdaTimeout,
    },
    queue: {
      alarmMaxAgeOfOldestMessage: Duration.hours(4),
      maxMessageCountAlarmThreshold: 5_000,
      maxReceiveCount: 3,
      visibilityTimeout: Duration.seconds(
        contributeResourceDiffBundlesLambdaTimeout.toSeconds() * 2 + 1
      ),
      createRetryLambda: false,
    },
    eventSource: {
      batchSize: 1,
      reportBatchItemFailures: true,
      maxConcurrency: 2,
    },
    waitTime: waitTimeContributeResourceDiffBundles,
  };
  const writeBackResourceDiffBundlesLambdaTimeout = Duration.minutes(15);
  const writeBackResourceDiffBundles: QueueAndLambdaSettings = {
    name: "EhrWriteBackResourceDiffBundles",
    entry: "ehr/write-back-resource-diff-bundles",
    lambda: {
      memory: 4096,
      timeout: writeBackResourceDiffBundlesLambdaTimeout,
    },
    queue: {
      alarmMaxAgeOfOldestMessage: Duration.hours(4),
      maxMessageCountAlarmThreshold: 5_000,
      maxReceiveCount: 3,
      visibilityTimeout: Duration.seconds(
        writeBackResourceDiffBundlesLambdaTimeout.toSeconds() * 2 + 1
      ),
      createRetryLambda: false,
    },
    eventSource: {
      batchSize: 1,
      reportBatchItemFailures: true,
      maxConcurrency: 2,
    },
    waitTime: waitTimeWriteBackResourceDiffBundles,
  };
  return {
    getAppointments,
    syncPatient,
    elationLinkPatient,
    healthieLinkPatient,
    computeResourceDiffBundles,
    refreshEhrBundles,
    contributeResourceDiffBundles,
    writeBackResourceDiffBundles,
  };
}

interface EhrNestedStackProps extends NestedStackProps {
  config: EnvConfig;
  vpc: ec2.IVpc;
  alarmAction?: SnsAction;
  lambdaLayers: LambdaLayers;
  ehrResponsesBucket: s3.Bucket | undefined;
  medicalDocumentsBucket: s3.Bucket;
  fhirConverterLambda: Lambda | undefined;
  fhirConverterBucket: s3.Bucket | undefined;
}

export class EhrNestedStack extends NestedStack {
  readonly getAppointmentsLambda: Lambda;
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
  readonly contributeResourceDiffBundlesLambda: Lambda;
  readonly contributeResourceDiffBundlesQueue: Queue;
  readonly writeBackResourceDiffBundlesLambda: Lambda;
  readonly writeBackResourceDiffBundlesQueue: Queue;
  readonly ehrBundleBucket: s3.Bucket;

  constructor(scope: Construct, id: string, props: EhrNestedStackProps) {
    super(scope, id, props);

    this.terminationProtection = true;

    this.getAppointmentsLambda = this.setupGetAppointmentslambda({
      lambdaLayers: props.lambdaLayers,
      vpc: props.vpc,
      envType: props.config.environmentType,
      sentryDsn: props.config.lambdasSentryDSN,
      alarmAction: props.alarmAction,
      ehrResponsesBucket: props.ehrResponsesBucket,
    });

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

    const contributeResourceDiffBundles = this.setupContributeResourceDiffBundles({
      lambdaLayers: props.lambdaLayers,
      vpc: props.vpc,
      envType: props.config.environmentType,
      sentryDsn: props.config.lambdasSentryDSN,
      alarmAction: props.alarmAction,
      ehrResponsesBucket: props.ehrResponsesBucket,
      ehrBundleBucket: this.ehrBundleBucket,
    });
    this.contributeResourceDiffBundlesLambda = contributeResourceDiffBundles.lambda;
    this.contributeResourceDiffBundlesQueue = contributeResourceDiffBundles.queue;

    const writeBackResourceDiffBundles = this.setupWriteBackResourceDiffBundles({
      lambdaLayers: props.lambdaLayers,
      vpc: props.vpc,
      envType: props.config.environmentType,
      sentryDsn: props.config.lambdasSentryDSN,
      alarmAction: props.alarmAction,
      ehrResponsesBucket: props.ehrResponsesBucket,
      medicalDocumentsBucket: props.medicalDocumentsBucket,
      ehrBundleBucket: this.ehrBundleBucket,
    });
    this.writeBackResourceDiffBundlesLambda = writeBackResourceDiffBundles.lambda;
    this.writeBackResourceDiffBundlesQueue = writeBackResourceDiffBundles.queue;

    const computeResourceDiffBundles = this.setupComputeResourceDiffBundles({
      lambdaLayers: props.lambdaLayers,
      vpc: props.vpc,
      envType: props.config.environmentType,
      sentryDsn: props.config.lambdasSentryDSN,
      alarmAction: props.alarmAction,
      ehrResponsesBucket: props.ehrResponsesBucket,
      medicalDocumentsBucket: props.medicalDocumentsBucket,
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
      ehrResponsesBucket: props.ehrResponsesBucket,
      ehrBundleBucket: this.ehrBundleBucket,
      fhirConverterLambda: props.fhirConverterLambda,
      fhirConverterBucket: props.fhirConverterBucket,
      computeResourceDiffBundlesQueue: this.computeResourceDiffBundlesQueue,
    });
    this.refreshEhrBundlesLambda = refreshEhrBundles.lambda;
    this.refreshEhrBundlesQueue = refreshEhrBundles.queue;
  }

  private setupGetAppointmentslambda(ownProps: {
    lambdaLayers: LambdaLayers;
    vpc: ec2.IVpc;
    envType: EnvType;
    sentryDsn: string | undefined;
    alarmAction: SnsAction | undefined;
    ehrResponsesBucket: s3.Bucket | undefined;
  }): Lambda {
    const { lambdaLayers, vpc, envType, sentryDsn, alarmAction } = ownProps;
    const { name, entry, lambda: lambdaSettings } = settings().getAppointments;

    const lambda = createLambda({
      ...lambdaSettings,
      stack: this,
      name,
      entry,
      envType,
      envVars: {
        // API_URL set on the api-stack after the OSS API is created
        ...(sentryDsn ? { SENTRY_DSN: sentryDsn } : {}),
        ...(ownProps.ehrResponsesBucket
          ? { EHR_RESPONSES_BUCKET_NAME: ownProps.ehrResponsesBucket.bucketName }
          : {}),
      },
      layers: [lambdaLayers.shared],
      vpc,
      alarmSnsAction: alarmAction,
    });

    ownProps.ehrResponsesBucket?.grantWrite(lambda);

    return lambda;
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

  private setupContributeResourceDiffBundles(ownProps: {
    lambdaLayers: LambdaLayers;
    vpc: ec2.IVpc;
    envType: EnvType;
    sentryDsn: string | undefined;
    alarmAction: SnsAction | undefined;
    ehrResponsesBucket: s3.Bucket | undefined;
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
    } = settings().contributeResourceDiffBundles;

    const queue = createQueue({
      ...queueSettings,
      stack: this,
      name,
      fifo: true,
      createDLQ: true,
      lambdaLayers: [lambdaLayers.shared, lambdaLayers.langchain],
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
        EHR_BUNDLE_BUCKET_NAME: ownProps.ehrBundleBucket.bucketName,
        WAIT_TIME_IN_MILLIS: waitTime.toMilliseconds().toString(),
        MAX_ATTEMPTS: queueSettings.maxReceiveCount.toString(),
        ...(sentryDsn ? { SENTRY_DSN: sentryDsn } : {}),
        ...(ownProps.ehrResponsesBucket
          ? { EHR_RESPONSES_BUCKET_NAME: ownProps.ehrResponsesBucket.bucketName }
          : {}),
      },
      layers: [lambdaLayers.shared, lambdaLayers.langchain],
      vpc,
      alarmSnsAction: alarmAction,
    });

    lambda.addEventSource(new SqsEventSource(queue, eventSourceSettings));

    ownProps.ehrResponsesBucket?.grantWrite(lambda);
    ownProps.ehrBundleBucket.grantReadWrite(lambda);

    return { lambda, queue };
  }

  private setupWriteBackResourceDiffBundles(ownProps: {
    lambdaLayers: LambdaLayers;
    vpc: ec2.IVpc;
    envType: EnvType;
    sentryDsn: string | undefined;
    alarmAction: SnsAction | undefined;
    ehrResponsesBucket: s3.Bucket | undefined;
    medicalDocumentsBucket: s3.Bucket;
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
    } = settings().writeBackResourceDiffBundles;

    const queue = createQueue({
      ...queueSettings,
      stack: this,
      name,
      fifo: true,
      createDLQ: true,
      lambdaLayers: [lambdaLayers.shared, lambdaLayers.langchain],
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
        MEDICAL_DOCUMENTS_BUCKET_NAME: ownProps.medicalDocumentsBucket.bucketName,
        EHR_BUNDLE_BUCKET_NAME: ownProps.ehrBundleBucket.bucketName,
        WAIT_TIME_IN_MILLIS: waitTime.toMilliseconds().toString(),
        MAX_ATTEMPTS: queueSettings.maxReceiveCount.toString(),
        ...(sentryDsn ? { SENTRY_DSN: sentryDsn } : {}),
        ...(ownProps.ehrResponsesBucket
          ? { EHR_RESPONSES_BUCKET_NAME: ownProps.ehrResponsesBucket.bucketName }
          : {}),
      },
      layers: [lambdaLayers.shared, lambdaLayers.langchain],
      vpc,
      alarmSnsAction: alarmAction,
    });

    lambda.addEventSource(new SqsEventSource(queue, eventSourceSettings));

    // Grant read to medical document bucket set on the api-stack
    ownProps.ehrResponsesBucket?.grantWrite(lambda);
    ownProps.ehrBundleBucket.grantReadWrite(lambda);

    return { lambda, queue };
  }

  private setupComputeResourceDiffBundles(ownProps: {
    lambdaLayers: LambdaLayers;
    vpc: ec2.IVpc;
    envType: EnvType;
    sentryDsn: string | undefined;
    alarmAction: SnsAction | undefined;
    ehrResponsesBucket: s3.Bucket | undefined;
    medicalDocumentsBucket: s3.Bucket;
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
      lambdaLayers: [lambdaLayers.shared, lambdaLayers.langchain],
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
        MEDICAL_DOCUMENTS_BUCKET_NAME: ownProps.medicalDocumentsBucket.bucketName,
        EHR_BUNDLE_BUCKET_NAME: ownProps.ehrBundleBucket.bucketName,
        WAIT_TIME_IN_MILLIS: waitTime.toMilliseconds().toString(),
        MAX_ATTEMPTS: queueSettings.maxReceiveCount.toString(),
        ...(sentryDsn ? { SENTRY_DSN: sentryDsn } : {}),
        ...(ownProps.ehrResponsesBucket
          ? { EHR_RESPONSES_BUCKET_NAME: ownProps.ehrResponsesBucket.bucketName }
          : {}),
      },
      layers: [lambdaLayers.shared, lambdaLayers.langchain],
      vpc,
      alarmSnsAction: alarmAction,
    });

    lambda.addEventSource(new SqsEventSource(queue, eventSourceSettings));

    // Grant read to medical document bucket set on the api-stack
    ownProps.ehrResponsesBucket?.grantWrite(lambda);
    ownProps.ehrBundleBucket.grantReadWrite(lambda);

    return { lambda, queue };
  }

  private setupRefreshEhrBundles(ownProps: {
    lambdaLayers: LambdaLayers;
    vpc: ec2.IVpc;
    envType: EnvType;
    sentryDsn: string | undefined;
    alarmAction: SnsAction | undefined;
    ehrResponsesBucket: s3.Bucket | undefined;
    ehrBundleBucket: s3.Bucket;
    fhirConverterLambda: Lambda | undefined;
    fhirConverterBucket: s3.Bucket | undefined;
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
      lambdaLayers: [lambdaLayers.shared, lambdaLayers.langchain],
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
        EHR_BUNDLE_BUCKET_NAME: ownProps.ehrBundleBucket.bucketName,
        EHR_COMPUTE_RESOURCE_DIFF_BUNDLES_QUEUE_URL:
          ownProps.computeResourceDiffBundlesQueue.queueUrl,
        ...(ownProps.fhirConverterLambda && {
          FHIR_CONVERTER_LAMBDA_NAME: ownProps.fhirConverterLambda.functionName,
        }),
        ...(ownProps.fhirConverterBucket && {
          FHIR_CONVERTER_BUCKET_NAME: ownProps.fhirConverterBucket.bucketName,
        }),
        WAIT_TIME_IN_MILLIS: waitTime.toMilliseconds().toString(),
        MAX_ATTEMPTS: queueSettings.maxReceiveCount.toString(),
        ...(sentryDsn ? { SENTRY_DSN: sentryDsn } : {}),
        ...(ownProps.ehrResponsesBucket
          ? { EHR_RESPONSES_BUCKET_NAME: ownProps.ehrResponsesBucket.bucketName }
          : {}),
      },
      layers: [lambdaLayers.shared, lambdaLayers.langchain],
      vpc,
      alarmSnsAction: alarmAction,
    });

    lambda.addEventSource(new SqsEventSource(queue, eventSourceSettings));

    ownProps.ehrResponsesBucket?.grantWrite(lambda);
    ownProps.ehrBundleBucket.grantReadWrite(lambda);
    ownProps.fhirConverterLambda?.grantInvoke(lambda);
    ownProps.fhirConverterBucket?.grantReadWrite(lambda);
    ownProps.computeResourceDiffBundlesQueue.grantSendMessages(lambda);

    return { lambda, queue };
  }
}
