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

const synchronizeSftpTimeout = Duration.minutes(15);
const sendPatientRequestLambdaTimeout = Duration.minutes(12);
const receiveVerificationLambdaTimeout = Duration.minutes(5);
const receiveFlatFileResponseLambdaTimeout = Duration.minutes(15);

interface SurescriptsSettings {
  synchronizeSftp: QueueAndLambdaSettings;
  sendPatientRequest: QueueAndLambdaSettings;
  receiveVerificationResponse: QueueAndLambdaSettings;
  receiveFlatFileResponse: QueueAndLambdaSettings;
}

const settings: SurescriptsSettings = {
  synchronizeSftp: {
    name: "SurescriptsSynchronizeSftp",
    entry: "surescripts-sftp-synchronize",
    lambda: {
      memory: 1024,
      timeout: synchronizeSftpTimeout,
    },
    queue: {
      alarmMaxAgeOfOldestMessage: Duration.hours(1),
      maxMessageCountAlarmThreshold: 1000,
      maxReceiveCount: 3,
      visibilityTimeout: Duration.seconds(synchronizeSftpTimeout.toSeconds() * 2 + 1),
      createRetryLambda: false,
    },
    eventSource: {
      batchSize: 1,
      reportBatchItemFailures: true,
      maxConcurrency: 4,
    },
    waitTime: Duration.seconds(1), // Max 60 syncs/minute
  },

  sendPatientRequest: {
    name: "SurescriptsSendPatientRequest",
    entry: "surescripts-send-patient-request",
    lambda: {
      memory: 1024,
      timeout: sendPatientRequestLambdaTimeout,
    },
    queue: {
      alarmMaxAgeOfOldestMessage: Duration.hours(3),
      maxMessageCountAlarmThreshold: 15_000,
      maxReceiveCount: 3,
      visibilityTimeout: Duration.seconds(sendPatientRequestLambdaTimeout.toSeconds() * 2 + 1),
      createRetryLambda: false,
    },
    eventSource: {
      batchSize: 1,
      reportBatchItemFailures: true,
      maxConcurrency: 4,
    },
    waitTime: Duration.seconds(0), // No limit
  },
  receiveVerificationResponse: {
    name: "SurescriptsReceiveVerificationResponse",
    entry: "surescripts-receive-verification-response",
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
    waitTime: Duration.seconds(0), // No limit
  },
  receiveFlatFileResponse: {
    name: "SurescriptsReceiveFlatFileResponse",
    entry: "surescripts-receive-flat-file-response",
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
    waitTime: Duration.seconds(0), // No limit
  },
};

function surescriptsEnvironmentVariables(
  surescripts: EnvConfig["surescripts"]
): Record<string, string> {
  if (!surescripts) {
    return {};
  }

  return {
    SURESCRIPTS_SFTP_HOST: surescripts.surescriptsHost,
    SURESCRIPTS_SFTP_SENDER_ID: surescripts.surescriptsSenderId,
    SURESCRIPTS_SFTP_RECEIVER_ID: surescripts.surescriptsReceiverId,
    SURESCRIPTS_SFTP_SENDER_PASSWORD_ARN: surescripts.secrets.SURESCRIPTS_SFTP_SENDER_PASSWORD_ARN,
    SURESCRIPTS_SFTP_PUBLIC_KEY_ARN: surescripts.secrets.SURESCRIPTS_SFTP_PUBLIC_KEY_ARN,
    SURESCRIPTS_SFTP_PRIVATE_KEY_ARN: surescripts.secrets.SURESCRIPTS_SFTP_PRIVATE_KEY_ARN,
    SURESCRIPTS_REPLICA_BUCKET_NAME: surescripts.surescriptsReplicaBucketName,
    SURESCRIPTS_BUNDLE_BUCKET_NAME: surescripts.pharmacyBundleBucketName,
  };
}

interface SurescriptsNestedStackProps extends NestedStackProps {
  config: EnvConfig;
  vpc: ec2.IVpc;
  alarmAction?: SnsAction;
  lambdaLayers: LambdaLayers;
}

export class SurescriptsNestedStack extends NestedStack {
  readonly synchronizeSftpLambda: Lambda;
  readonly sendPatientRequestLambda: Lambda;
  readonly sendPatientRequestQueue: Queue;
  readonly receiveVerificationResponseLambda: Lambda;
  readonly receiveVerificationResponseQueue: Queue;
  readonly receiveFlatFileResponseLambda: Lambda;
  readonly receiveFlatFileResponseQueue: Queue;
  readonly pharmacyBundleBucket: s3.Bucket;
  readonly surescriptsReplicaBucket: s3.Bucket;

  constructor(scope: Construct, id: string, props: SurescriptsNestedStackProps) {
    super(scope, id, props);

    this.terminationProtection = true;

    this.pharmacyBundleBucket = new s3.Bucket(this, "PharmacyBundleBucket", {
      bucketName: props.config.surescripts?.pharmacyBundleBucketName,
      publicReadAccess: false,
      encryption: s3.BucketEncryption.S3_MANAGED,
      versioned: true,
    });

    this.surescriptsReplicaBucket = new s3.Bucket(this, "SurescriptsReplicaBucket", {
      bucketName: props.config.surescripts?.surescriptsReplicaBucketName,
      publicReadAccess: false,
      encryption: s3.BucketEncryption.S3_MANAGED,
      versioned: true,
    });

    const commonConfig = {
      lambdaLayers: props.lambdaLayers,
      vpc: props.vpc,
      envType: props.config.environmentType,
      sentryDsn: props.config.lambdasSentryDSN,
      alarmAction: props.alarmAction,
      surescripts: props.config.surescripts,
      envVars: surescriptsEnvironmentVariables(props.config.surescripts),
    };

    const synchronizeSftp = this.setupSynchronizeSftp({
      ...commonConfig,
      surescriptsReplicaBucket: this.surescriptsReplicaBucket,
    });
    this.synchronizeSftpLambda = synchronizeSftp.lambda;

    const sendPatientRequest = this.setupSendPatientRequest({
      ...commonConfig,
      surescriptsReplicaBucket: this.surescriptsReplicaBucket,
    });
    this.sendPatientRequestLambda = sendPatientRequest.lambda;
    this.sendPatientRequestQueue = sendPatientRequest.queue;

    const receiveVerificationResponse = this.setupReceiveVerificationResponse({
      ...commonConfig,
      surescriptsReplicaBucket: this.surescriptsReplicaBucket,
    });
    this.receiveVerificationResponseLambda = receiveVerificationResponse.lambda;
    this.receiveVerificationResponseQueue = receiveVerificationResponse.queue;

    const receiveFlatFileResponse = this.setupReceiveFlatFileResponse({
      ...commonConfig,
      surescriptsReplicaBucket: this.surescriptsReplicaBucket,
      surescriptsBundleBucket: this.pharmacyBundleBucket,
    });
    this.receiveFlatFileResponseLambda = receiveFlatFileResponse.lambda;
    this.receiveFlatFileResponseQueue = receiveFlatFileResponse.queue;
  }

  private setupSynchronizeSftp(ownProps: {
    lambdaLayers: LambdaLayers;
    vpc: ec2.IVpc;
    envType: EnvType;
    envVars: Record<string, string>;
    sentryDsn: string | undefined;
    alarmAction: SnsAction | undefined;
    surescriptsReplicaBucket: s3.Bucket;
    surescripts: EnvConfig["surescripts"];
  }): { lambda: Lambda; queue: Queue } {
    const {
      lambdaLayers,
      vpc,
      envType,
      envVars,
      sentryDsn,
      alarmAction,
      surescriptsReplicaBucket,
    } = ownProps;
    const {
      name,
      entry,
      lambda: lambdaSettings,
      queue: queueSettings,
      eventSource: eventSourceSettings,
      waitTime,
    } = settings.synchronizeSftp;

    const lambda = createLambda({
      ...lambdaSettings,
      stack: this,
      name,
      entry,
      envType,
      envVars: {
        ...envVars,
        ...(sentryDsn ? { SENTRY_DSN: sentryDsn } : {}),
        WAIT_TIME_IN_MILLIS: waitTime.toMilliseconds().toString(),
      },
      layers: [lambdaLayers.shared],
      vpc,
      alarmSnsAction: alarmAction,
    });

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

    lambda.addEventSource(new SqsEventSource(queue, eventSourceSettings));
    surescriptsReplicaBucket.grantReadWrite(lambda);

    return { lambda, queue };
  }

  private setupSendPatientRequest(ownProps: {
    lambdaLayers: LambdaLayers;
    vpc: ec2.IVpc;
    envType: EnvType;
    envVars: Record<string, string>;
    sentryDsn: string | undefined;
    alarmAction: SnsAction | undefined;
    surescriptsReplicaBucket: s3.Bucket;
    surescripts: EnvConfig["surescripts"];
  }): { lambda: Lambda; queue: Queue } {
    const {
      lambdaLayers,
      vpc,
      envType,
      envVars,
      sentryDsn,
      alarmAction,
      surescriptsReplicaBucket,
    } = ownProps;
    const {
      name,
      entry,
      lambda: lambdaSettings,
      queue: queueSettings,
      eventSource: eventSourceSettings,
      waitTime,
    } = settings.sendPatientRequest;

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
        ...envVars,
        ...(sentryDsn ? { SENTRY_DSN: sentryDsn } : {}),
        WAIT_TIME_IN_MILLIS: waitTime.toMilliseconds().toString(),
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
    envVars: Record<string, string>;
    sentryDsn: string | undefined;
    alarmAction: SnsAction | undefined;
    surescriptsReplicaBucket: s3.Bucket;
    surescripts: EnvConfig["surescripts"];
  }): { lambda: Lambda; queue: Queue } {
    const {
      lambdaLayers,
      vpc,
      envType,
      envVars,
      sentryDsn,
      alarmAction,
      surescriptsReplicaBucket,
    } = ownProps;
    const {
      name,
      entry,
      lambda: lambdaSettings,
      queue: queueSettings,
      eventSource: eventSourceSettings,
      waitTime,
    } = settings.receiveVerificationResponse;

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
        ...envVars,
        ...(sentryDsn ? { SENTRY_DSN: sentryDsn } : {}),
        WAIT_TIME_IN_MILLIS: waitTime.toMilliseconds().toString(),
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
    envVars: Record<string, string>;
    sentryDsn: string | undefined;
    alarmAction: SnsAction | undefined;
    surescriptsReplicaBucket: s3.Bucket;
    surescriptsBundleBucket: s3.Bucket;
    surescripts: EnvConfig["surescripts"];
  }): { lambda: Lambda; queue: Queue } {
    const {
      lambdaLayers,
      vpc,
      envType,
      envVars,
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
      waitTime,
    } = settings.receiveFlatFileResponse;

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
        ...envVars,
        ...(sentryDsn ? { SENTRY_DSN: sentryDsn } : {}),
        WAIT_TIME_IN_MILLIS: waitTime.toMilliseconds().toString(),
      },
      layers: [lambdaLayers.shared],
      vpc,
      alarmSnsAction: alarmAction,
    });

    lambda.addEventSource(new SqsEventSource(queue, eventSourceSettings));

    surescriptsBundleBucket.grantReadWrite(lambda);
    surescriptsReplicaBucket.grantReadWrite(lambda);

    return { lambda, queue };
  }
}
