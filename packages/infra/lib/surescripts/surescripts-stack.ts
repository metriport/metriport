import { Duration, NestedStack, NestedStackProps } from "aws-cdk-lib";
import { SnsAction } from "aws-cdk-lib/aws-cloudwatch-actions";
import * as ec2 from "aws-cdk-lib/aws-ec2";
import { Function as Lambda, Runtime } from "aws-cdk-lib/aws-lambda";
import { SqsEventSource } from "aws-cdk-lib/aws-lambda-event-sources";
import * as s3 from "aws-cdk-lib/aws-s3";
import * as secret from "aws-cdk-lib/aws-secretsmanager";
import { Queue } from "aws-cdk-lib/aws-sqs";
import { Construct } from "constructs";
import { EnvConfig } from "../../config/env-config";
import { EnvType } from "../env-type";
import { createLambda } from "../shared/lambda";
import { LambdaLayers } from "../shared/lambda-layers";
import { QueueAndLambdaSettings } from "../shared/settings";
import { createQueue } from "../shared/sqs";
import { SurescriptsAssets } from "./types";

const synchronizeSftpTimeout = Duration.minutes(5);
const synchronizeSftpWaitTime = Duration.seconds(1);
const sendPatientRequestLambdaTimeout = Duration.seconds(30);
const receiveVerificationLambdaTimeout = Duration.seconds(30);
const receiveFlatFileResponseLambdaTimeout = Duration.seconds(30);
const alarmMaxAgeOfOldestMessage = Duration.hours(1);
const maxConcurrencyForSftpOperations = 2;
const maxConcurrencyForFileOperations = 4;
const apiUrlEnvVarName = "API_URL";

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
      alarmMaxAgeOfOldestMessage,
      maxMessageCountAlarmThreshold: 1000,
      maxReceiveCount: 3,
      visibilityTimeout: Duration.seconds(synchronizeSftpTimeout.toSeconds() * 2 + 1),
      createRetryLambda: false,
    },
    eventSource: {
      batchSize: 1,
      reportBatchItemFailures: true,
      maxConcurrency: maxConcurrencyForSftpOperations,
    },
    waitTime: synchronizeSftpWaitTime,
  },

  sendPatientRequest: {
    name: "SurescriptsSendPatientRequest",
    entry: "surescripts-send-patient-request",
    lambda: {
      memory: 1024,
      timeout: sendPatientRequestLambdaTimeout,
    },
    queue: {
      alarmMaxAgeOfOldestMessage,
      maxMessageCountAlarmThreshold: 15_000,
      maxReceiveCount: 3,
      visibilityTimeout: Duration.seconds(sendPatientRequestLambdaTimeout.toSeconds() * 2 + 1),
      createRetryLambda: false,
    },
    eventSource: {
      batchSize: 1,
      reportBatchItemFailures: true,
      maxConcurrency: maxConcurrencyForFileOperations,
    },
    waitTime: Duration.seconds(0),
  },
  receiveVerificationResponse: {
    name: "SurescriptsReceiveVerificationResponse",
    entry: "surescripts-receive-verification-response",
    lambda: {
      memory: 1024,
      timeout: receiveVerificationLambdaTimeout,
    },
    queue: {
      alarmMaxAgeOfOldestMessage,
      maxMessageCountAlarmThreshold: 15_000,
      maxReceiveCount: 3,
      visibilityTimeout: Duration.seconds(receiveVerificationLambdaTimeout.toSeconds() * 2 + 1),
      createRetryLambda: false,
    },
    eventSource: {
      batchSize: 1,
      reportBatchItemFailures: true,
      maxConcurrency: maxConcurrencyForFileOperations,
    },
    waitTime: Duration.seconds(0),
  },
  receiveFlatFileResponse: {
    name: "SurescriptsReceiveFlatFileResponse",
    entry: "surescripts-receive-flat-file-response",
    lambda: {
      memory: 1024,
      timeout: receiveFlatFileResponseLambdaTimeout,
    },
    queue: {
      alarmMaxAgeOfOldestMessage,
      maxMessageCountAlarmThreshold: 15_000,
      maxReceiveCount: 3,
      visibilityTimeout: Duration.seconds(receiveFlatFileResponseLambdaTimeout.toSeconds() * 2 + 1),
      createRetryLambda: false,
    },
    eventSource: {
      batchSize: 1,
      reportBatchItemFailures: true,
      maxConcurrency: maxConcurrencyForFileOperations,
    },
    waitTime: Duration.seconds(0),
  },
};

function surescriptsEnvironmentVariablesAndSecrets({
  nestedStack,
  surescripts,
  surescriptsReplicaBucket,
  pharmacyConversionBucket,
}: {
  nestedStack: SurescriptsNestedStack;
  surescripts: EnvConfig["surescripts"];
  surescriptsReplicaBucket: s3.Bucket;
  pharmacyConversionBucket: s3.Bucket;
}): { envVars: Record<string, string>; secrets: secret.ISecret[] } {
  if (!surescripts) {
    return { envVars: {}, secrets: [] };
  }

  const envVars: Record<string, string> = {
    SURESCRIPTS_SFTP_HOST: surescripts.surescriptsHost,
    SURESCRIPTS_SFTP_SENDER_ID: surescripts.surescriptsSenderId,
    SURESCRIPTS_SFTP_RECEIVER_ID: surescripts.surescriptsReceiverId,
    SURESCRIPTS_REPLICA_BUCKET_NAME: surescriptsReplicaBucket.bucketName,
    PHARMACY_CONVERSION_BUCKET_NAME: pharmacyConversionBucket.bucketName,
  };

  const secrets: secret.ISecret[] = [];
  const senderPasswordSecret = buildSecret(
    nestedStack,
    surescripts.secrets.SURESCRIPTS_SFTP_SENDER_PASSWORD
  );
  envVars.SURESCRIPTS_SFTP_SENDER_PASSWORD_NAME = senderPasswordSecret.secretName;
  secrets.push(senderPasswordSecret);

  const publicKeySecret = buildSecret(nestedStack, surescripts.secrets.SURESCRIPTS_SFTP_PUBLIC_KEY);
  envVars.SURESCRIPTS_SFTP_PUBLIC_KEY_NAME = publicKeySecret.secretName;
  secrets.push(publicKeySecret);

  const privateKeySecret = buildSecret(
    nestedStack,
    surescripts.secrets.SURESCRIPTS_SFTP_PRIVATE_KEY
  );
  envVars.SURESCRIPTS_SFTP_PRIVATE_KEY_NAME = privateKeySecret.secretName;
  secrets.push(privateKeySecret);

  return { envVars, secrets };
}

function buildSecret(nestedStack: SurescriptsNestedStack, name: string): secret.ISecret {
  return secret.Secret.fromSecretNameV2(nestedStack, name, name);
}

interface SurescriptsNestedStackProps extends NestedStackProps {
  config: EnvConfig;
  vpc: ec2.IVpc;
  alarmAction?: SnsAction;
  lambdaLayers: LambdaLayers;
}

export class SurescriptsNestedStack extends NestedStack {
  private readonly synchronizeSftpLambda: Lambda;
  private readonly synchronizeSftpQueue: Queue;
  private readonly sendPatientRequestLambda: Lambda;
  private readonly sendPatientRequestQueue: Queue;
  private readonly receiveVerificationResponseLambda: Lambda;
  private readonly receiveVerificationResponseQueue: Queue;
  private readonly receiveFlatFileResponseLambda: Lambda;
  private readonly receiveFlatFileResponseQueue: Queue;
  private readonly surescriptsReplicaBucket: s3.Bucket;
  private readonly pharmacyConversionBucket: s3.Bucket;

  constructor(scope: Construct, id: string, props: SurescriptsNestedStackProps) {
    super(scope, id, props);

    this.terminationProtection = true;

    this.surescriptsReplicaBucket = new s3.Bucket(this, "SurescriptsReplicaBucket", {
      bucketName: props.config.surescriptsReplicaBucketName,
      publicReadAccess: false,
      encryption: s3.BucketEncryption.S3_MANAGED,
      versioned: true,
    });

    this.pharmacyConversionBucket = new s3.Bucket(this, "PharmacyBundleBucket", {
      bucketName: props.config.pharmacyConversionBucketName,
      publicReadAccess: false,
      encryption: s3.BucketEncryption.S3_MANAGED,
      versioned: true,
    });

    const { envVars, secrets } = surescriptsEnvironmentVariablesAndSecrets({
      nestedStack: this,
      surescripts: props.config.surescripts,
      surescriptsReplicaBucket: this.surescriptsReplicaBucket,
      pharmacyConversionBucket: this.pharmacyConversionBucket,
    });

    const commonConfig = {
      lambdaLayers: props.lambdaLayers,
      vpc: props.vpc,
      envType: props.config.environmentType,
      sentryDsn: props.config.lambdasSentryDSN,
      alarmAction: props.alarmAction,
      surescripts: props.config.surescripts,
      systemRootOID: props.config.systemRootOID,
      envVars,
    };

    const synchronizeSftp = this.setupLambdaAndQueue("synchronizeSftp", {
      ...commonConfig,
      surescriptsReplicaBucket: this.surescriptsReplicaBucket,
    });
    this.synchronizeSftpLambda = synchronizeSftp.lambda;
    this.synchronizeSftpQueue = synchronizeSftp.queue;

    const sendPatientRequest = this.setupLambdaAndQueue("sendPatientRequest", {
      ...commonConfig,
      surescriptsReplicaBucket: this.surescriptsReplicaBucket,
    });
    this.sendPatientRequestLambda = sendPatientRequest.lambda;
    this.sendPatientRequestQueue = sendPatientRequest.queue;

    const receiveVerificationResponse = this.setupLambdaAndQueue("receiveVerificationResponse", {
      ...commonConfig,
      surescriptsReplicaBucket: this.surescriptsReplicaBucket,
    });
    this.receiveVerificationResponseLambda = receiveVerificationResponse.lambda;
    this.receiveVerificationResponseQueue = receiveVerificationResponse.queue;

    const receiveFlatFileResponse = this.setupLambdaAndQueue("receiveFlatFileResponse", {
      ...commonConfig,
      surescriptsReplicaBucket: this.surescriptsReplicaBucket,
      pharmacyConversionBucket: this.pharmacyConversionBucket,
    });
    this.receiveFlatFileResponseLambda = receiveFlatFileResponse.lambda;
    this.receiveFlatFileResponseQueue = receiveFlatFileResponse.queue;

    for (const secret of secrets) {
      secret.grantRead(this.synchronizeSftpLambda);
      secret.grantRead(this.sendPatientRequestLambda);
      secret.grantRead(this.receiveVerificationResponseLambda);
      secret.grantRead(this.receiveFlatFileResponseLambda);
    }
  }

  getAssets(): SurescriptsAssets {
    return {
      synchronizeSftpLambda: this.synchronizeSftpLambda,
      synchronizeSftpQueue: this.synchronizeSftpQueue,
      sendPatientRequestLambda: this.sendPatientRequestLambda,
      sendPatientRequestQueue: this.sendPatientRequestQueue,
      receiveVerificationResponseLambda: this.receiveVerificationResponseLambda,
      receiveVerificationResponseQueue: this.receiveVerificationResponseQueue,
      receiveFlatFileResponseLambda: this.receiveFlatFileResponseLambda,
      receiveFlatFileResponseQueue: this.receiveFlatFileResponseQueue,
      surescriptsReplicaBucket: this.surescriptsReplicaBucket,
      pharmacyConversionBucket: this.pharmacyConversionBucket,
    };
  }

  setApiUrl(apiUrl: string): void {
    const lambdasToSetApiUrl = [
      this.synchronizeSftpLambda,
      this.sendPatientRequestLambda,
      this.receiveVerificationResponseLambda,
      this.receiveFlatFileResponseLambda,
    ];
    lambdasToSetApiUrl.forEach(lambda => lambda.addEnvironment(apiUrlEnvVarName, apiUrl));
  }

  private setupLambdaAndQueue<T extends keyof SurescriptsSettings>(
    job: T,
    props: {
      lambdaLayers: LambdaLayers;
      vpc: ec2.IVpc;
      envType: EnvType;
      envVars: Record<string, string>;
      sentryDsn: string | undefined;
      alarmAction: SnsAction | undefined;
      systemRootOID: string;
      surescriptsReplicaBucket: s3.Bucket;
      pharmacyConversionBucket?: s3.Bucket;
    }
  ): { lambda: Lambda; queue: Queue } {
    const {
      lambdaLayers,
      vpc,
      envType,
      envVars,
      sentryDsn,
      alarmAction,
      systemRootOID,
      surescriptsReplicaBucket,
      pharmacyConversionBucket,
    } = props;

    const {
      name,
      entry,
      lambda: lambdaSettings,
      queue: queueSettings,
      eventSource: eventSourceSettings,
      waitTime,
    } = settings[job];

    const queue = createQueue({
      ...queueSettings,
      stack: this,
      name,
      createDLQ: true,
      lambdaLayers: [lambdaLayers.shared],
      envType,
      alarmSnsAction: alarmAction,
      receiveMessageWaitTime: waitTime,
    });

    const lambda = createLambda({
      ...lambdaSettings,
      stack: this,
      name,
      entry,
      envType,
      runtime: Runtime.NODEJS_20_X,
      envVars: {
        ...envVars,
        ...(sentryDsn ? { SENTRY_DSN: sentryDsn } : {}),
        SYSTEM_ROOT_OID: systemRootOID,
      },
      layers: [lambdaLayers.shared],
      vpc,
      alarmSnsAction: alarmAction,
    });

    surescriptsReplicaBucket.grantReadWrite(lambda);
    pharmacyConversionBucket?.grantReadWrite(lambda);

    lambda.addEventSource(
      new SqsEventSource(queue, {
        ...eventSourceSettings,
        maxBatchingWindow: waitTime,
      })
    );

    return { lambda, queue };
  }
}
