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
const waitTimeRefreshBundle = Duration.seconds(0); // No limit

function settings(): {
  connectSftp: QueueAndLambdaSettings;
  synchronizeSftp: QueueAndLambdaSettings;
  generatePatientRequest: QueueAndLambdaSettings;
  receiveVerificationResponse: QueueAndLambdaSettings;
  receiveFlatFileResponse: QueueAndLambdaSettings;
} {
  const connectSftp: QueueAndLambdaSettings = {
    name: "SurescriptsConnectSftp",
    entry: "surescripts-connect-sftp",
    lambda: {
      memory: 512,
      timeout: Duration.seconds(30),
    },
    queue: {
      alarmMaxAgeOfOldestMessage: Duration.minutes(10),
      maxMessageCountAlarmThreshold: 100,
      maxReceiveCount: 3,
      visibilityTimeout: Duration.seconds(10 * 2 + 1),
      createRetryLambda: false,
    },
    eventSource: {
      batchSize: 1,
      reportBatchItemFailures: true,
    },
    waitTime: waitTimePatientSync,
  };

  const syncPatientLambdaTimeout = waitTimePatientSync.plus(Duration.seconds(25));
  const synchronizeSftp: QueueAndLambdaSettings = {
    name: "SurescriptsSynchronizeSftp",
    entry: "surescripts-synchronize-sftp",
    lambda: {
      memory: 1024,
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

  // Skip adding the wait time to the lambda timeout because it's already sub 1 second
  const generatePatientRequestLambdaTimeout = Duration.minutes(12);
  const generatePatientRequest: QueueAndLambdaSettings = {
    name: "SurescriptsRequest",
    entry: "surescripts-request",
    lambda: {
      memory: 1024,
      timeout: generatePatientRequestLambdaTimeout,
    },
    queue: {
      alarmMaxAgeOfOldestMessage: Duration.hours(3),
      maxMessageCountAlarmThreshold: 15_000,
      maxReceiveCount: 3,
      visibilityTimeout: Duration.seconds(generatePatientRequestLambdaTimeout.toSeconds() * 2 + 1),
      createRetryLambda: false,
    },
    eventSource: {
      batchSize: 1,
      reportBatchItemFailures: true,
      maxConcurrency: 4,
    },
    waitTime: waitTimeRefreshBundle,
  };

  // Skip adding the wait time to the lambda timeout because it's already sub 1 second
  const receiveVerificationLambdaTimeout = Duration.minutes(1);
  const receiveVerificationResponse: QueueAndLambdaSettings = {
    name: "SurescriptsVerification",
    entry: "surescripts-verification",
    lambda: {
      memory: 1024,
      timeout: receiveVerificationLambdaTimeout,
    },
    queue: {
      alarmMaxAgeOfOldestMessage: Duration.hours(1),
      maxMessageCountAlarmThreshold: 15_000,
      maxReceiveCount: 3,
      visibilityTimeout: Duration.seconds(receiveVerificationLambdaTimeout.toSeconds() * 2 + 1),
      createRetryLambda: false,
    },
    eventSource: {
      batchSize: 1,
      reportBatchItemFailures: true,
      maxConcurrency: 4,
    },
    waitTime: waitTimeRefreshBundle,
  };

  // Skip adding the wait time to the lambda timeout because it's already sub 1 second
  const receiveFlatFileResponseLambdaTimeout = Duration.minutes(15);
  const receiveFlatFileResponse: QueueAndLambdaSettings = {
    name: "SurescriptsResponse",
    entry: "surescripts-response",
    lambda: {
      memory: 1024,
      timeout: receiveFlatFileResponseLambdaTimeout,
    },
    queue: {
      alarmMaxAgeOfOldestMessage: Duration.hours(1),
      maxMessageCountAlarmThreshold: 15_000,
      maxReceiveCount: 3,
      visibilityTimeout: Duration.seconds(receiveFlatFileResponseLambdaTimeout.toSeconds() * 2 + 1),
      createRetryLambda: false,
    },
    eventSource: {
      batchSize: 1,
      reportBatchItemFailures: true,
      maxConcurrency: 4,
    },
    waitTime: waitTimeRefreshBundle,
  };

  return {
    connectSftp,
    synchronizeSftp,
    generatePatientRequest,
    receiveVerificationResponse,
    receiveFlatFileResponse,
  };
}

interface SurescriptsNestedStackProps extends NestedStackProps {
  config: EnvConfig;
  vpc: ec2.IVpc;
  alarmAction?: SnsAction;
  lambdaLayers: LambdaLayers;
  surescriptsReplicaBucket: s3.Bucket;
  surescriptsBundleBucket: s3.Bucket;
}

export class SurescriptsNestedStack extends NestedStack {
  readonly connectSftpLambda: Lambda;
  readonly synchronizeSftpLambda: Lambda;
  readonly generatePatientRequestLambda: Lambda;
  readonly generatePatientRequestQueue: Queue;
  readonly receiveVerificationResponseLambda: Lambda;
  readonly receiveVerificationResponseQueue: Queue;
  readonly receiveFlatFileResponseLambda: Lambda;
  readonly receiveFlatFileResponseQueue: Queue;

  readonly surescriptsBundleBucket: s3.Bucket;
  readonly surescriptsReplicaBucket: s3.Bucket;

  constructor(scope: Construct, id: string, props: SurescriptsNestedStackProps) {
    super(scope, id, props);

    this.terminationProtection = true;

    const surescriptsBundleBucket = new s3.Bucket(this, "SurescriptsBundleBucket", {
      bucketName: props.config.surescripts?.surescriptsBundleBucketName,
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
    this.surescriptsBundleBucket = surescriptsBundleBucket;

    const surescriptsReplicaBucket = new s3.Bucket(this, "SurescriptsReplicaBucket", {
      bucketName: props.config.surescripts?.surescriptsReplicaBucketName,
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
    this.surescriptsReplicaBucket = surescriptsReplicaBucket;

    // Only scoped to read/write from the S3 bucket
    const connectSftp = this.setupConnectSftp({
      lambdaLayers: props.lambdaLayers,
      vpc: props.vpc,
      envType: props.config.environmentType,
      sentryDsn: props.config.lambdasSentryDSN,
      alarmAction: props.alarmAction,
    });
    this.connectSftpLambda = connectSftp.lambda;

    // Only scoped to read/write from the S3 bucket
    const synchronizeSftp = this.setupSynchronizeSftp({
      lambdaLayers: props.lambdaLayers,
      vpc: props.vpc,
      envType: props.config.environmentType,
      sentryDsn: props.config.lambdasSentryDSN,
      alarmAction: props.alarmAction,
      surescriptsReplicaBucket: surescriptsReplicaBucket,
    });
    this.synchronizeSftpLambda = synchronizeSftp.lambda;

    const generatePatientRequest = this.setupGeneratePatientRequest({
      lambdaLayers: props.lambdaLayers,
      vpc: props.vpc,
      envType: props.config.environmentType,
      sentryDsn: props.config.lambdasSentryDSN,
      alarmAction: props.alarmAction,
      surescriptsReplicaBucket: surescriptsReplicaBucket,
    });
    this.generatePatientRequestLambda = generatePatientRequest.lambda;
    this.generatePatientRequestQueue = generatePatientRequest.queue;

    const receiveVerificationResponse = this.setupReceiveVerificationResponse({
      lambdaLayers: props.lambdaLayers,
      vpc: props.vpc,
      envType: props.config.environmentType,
      sentryDsn: props.config.lambdasSentryDSN,
      alarmAction: props.alarmAction,
      surescriptsReplicaBucket: surescriptsReplicaBucket,
    });
    this.receiveVerificationResponseLambda = receiveVerificationResponse.lambda;
    this.receiveVerificationResponseQueue = receiveVerificationResponse.queue;

    const receiveFlatFileResponse = this.setupReceiveFlatFileResponse({
      lambdaLayers: props.lambdaLayers,
      vpc: props.vpc,
      envType: props.config.environmentType,
      sentryDsn: props.config.lambdasSentryDSN,
      alarmAction: props.alarmAction,
      surescriptsReplicaBucket: surescriptsReplicaBucket,
      surescriptsBundleBucket: this.surescriptsBundleBucket,
    });
    this.receiveFlatFileResponseLambda = receiveFlatFileResponse.lambda;
    this.receiveFlatFileResponseQueue = receiveFlatFileResponse.queue;
  }

  private setupConnectSftp(ownProps: {
    lambdaLayers: LambdaLayers;
    vpc: ec2.IVpc;
    envType: EnvType;
    sentryDsn: string | undefined;
    alarmAction: SnsAction | undefined;
  }): { lambda: Lambda } {
    const { lambdaLayers, vpc, envType, sentryDsn, alarmAction } = ownProps;
    const { name, entry, lambda: lambdaSettings } = settings().connectSftp;

    const lambda = createLambda({
      ...lambdaSettings,
      stack: this,
      name,
      entry,
      envType,
      envVars: {
        ...(sentryDsn ? { SENTRY_DSN: sentryDsn } : {}),
      },
      layers: [lambdaLayers.shared],
      vpc,
      alarmSnsAction: alarmAction,
    });

    return { lambda };
  }

  private setupSynchronizeSftp(ownProps: {
    lambdaLayers: LambdaLayers;
    vpc: ec2.IVpc;
    envType: EnvType;
    sentryDsn: string | undefined;
    alarmAction: SnsAction | undefined;
    surescriptsReplicaBucket: s3.Bucket;
  }): { lambda: Lambda } {
    const { lambdaLayers, vpc, envType, sentryDsn, alarmAction, surescriptsReplicaBucket } =
      ownProps;
    const { name, entry, lambda: lambdaSettings, waitTime } = settings().synchronizeSftp;

    const lambda = createLambda({
      ...lambdaSettings,
      stack: this,
      name,
      entry,
      envType,
      envVars: {
        SURESCRIPTS_REPLICA_BUCKET_NAME: surescriptsReplicaBucket.bucketName,
        // API_URL set on the api-stack after the OSS API is created
        WAIT_TIME_IN_MILLIS: waitTime.toMilliseconds().toString(),
        ...(sentryDsn ? { SENTRY_DSN: sentryDsn } : {}),
      },
      layers: [lambdaLayers.shared],
      vpc,
      alarmSnsAction: alarmAction,
    });

    surescriptsReplicaBucket.grantReadWrite(lambda);

    return { lambda };
  }

  private setupGeneratePatientRequest(ownProps: {
    lambdaLayers: LambdaLayers;
    vpc: ec2.IVpc;
    envType: EnvType;
    sentryDsn: string | undefined;
    alarmAction: SnsAction | undefined;
    surescriptsReplicaBucket: s3.Bucket;
  }): { lambda: Lambda; queue: Queue } {
    const { lambdaLayers, vpc, envType, sentryDsn, alarmAction, surescriptsReplicaBucket } =
      ownProps;
    const {
      name,
      entry,
      lambda: lambdaSettings,
      queue: queueSettings,
      eventSource: eventSourceSettings,
    } = settings().generatePatientRequest;

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
        SURESCRIPTS_REPLICA_BUCKET_NAME: surescriptsReplicaBucket.bucketName,
        ...(sentryDsn ? { SENTRY_DSN: sentryDsn } : {}),
      },
      layers: [lambdaLayers.shared],
      vpc,
      alarmSnsAction: alarmAction,
    });

    surescriptsReplicaBucket.grantReadWrite(lambda);

    lambda.addEventSource(new SqsEventSource(queue, eventSourceSettings));

    return { lambda, queue };
  }

  private setupReceiveVerificationResponse(ownProps: {
    lambdaLayers: LambdaLayers;
    vpc: ec2.IVpc;
    envType: EnvType;
    sentryDsn: string | undefined;
    alarmAction: SnsAction | undefined;
    surescriptsReplicaBucket: s3.Bucket;
  }): { lambda: Lambda; queue: Queue } {
    const { lambdaLayers, vpc, envType, sentryDsn, alarmAction, surescriptsReplicaBucket } =
      ownProps;
    const {
      name,
      entry,
      lambda: lambdaSettings,
      queue: queueSettings,
      eventSource: eventSourceSettings,
    } = settings().receiveVerificationResponse;

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
        SURESCRIPTS_REPLICA_BUCKET_NAME: surescriptsReplicaBucket.bucketName,
        ...(sentryDsn ? { SENTRY_DSN: sentryDsn } : {}),
      },
      layers: [lambdaLayers.shared],
      vpc,
      alarmSnsAction: alarmAction,
    });

    surescriptsReplicaBucket.grantReadWrite(lambda);

    lambda.addEventSource(new SqsEventSource(queue, eventSourceSettings));

    return { lambda, queue };
  }

  private setupReceiveFlatFileResponse(ownProps: {
    lambdaLayers: LambdaLayers;
    vpc: ec2.IVpc;
    envType: EnvType;
    sentryDsn: string | undefined;
    alarmAction: SnsAction | undefined;
    surescriptsReplicaBucket: s3.Bucket;
    surescriptsBundleBucket: s3.Bucket;
  }): { lambda: Lambda; queue: Queue } {
    const {
      lambdaLayers,
      vpc,
      envType,
      sentryDsn,
      alarmAction,
      surescriptsReplicaBucket,
      surescriptsBundleBucket,
    } = ownProps;
    const {
      name,
      entry,
      lambda: lambdaSettings,
      queue: queueSettings,
      eventSource: eventSourceSettings,
    } = settings().receiveFlatFileResponse;

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
        SURESCRIPTS_REPLICA_BUCKET_NAME: surescriptsReplicaBucket.bucketName,
        SURESCRIPTS_BUNDLE_BUCKET_NAME: surescriptsBundleBucket.bucketName,
        ...(sentryDsn ? { SENTRY_DSN: sentryDsn } : {}),
      },
      layers: [lambdaLayers.shared],
      vpc,
      alarmSnsAction: alarmAction,
    });

    lambda.addEventSource(new SqsEventSource(queue, eventSourceSettings));

    // Grant read to medical document bucket set on the api-stack
    surescriptsBundleBucket.grantReadWrite(lambda);
    surescriptsReplicaBucket.grantReadWrite(lambda);

    return { lambda, queue };
  }
}
