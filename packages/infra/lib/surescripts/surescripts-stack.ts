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
import { LambdaSettings, QueueAndLambdaSettings } from "../shared/settings";
import { createQueue } from "../shared/sqs";
import { SurescriptsAssets } from "./types";

const sftpActionTimeout = Duration.seconds(30);
const sendPatientRequestLambdaTimeout = Duration.seconds(30);
const sendBatchRequestLambdaTimeout = Duration.minutes(5);
const receiveVerificationLambdaTimeout = Duration.seconds(30);
const receiveResponseLambdaTimeout = Duration.seconds(30);
const alarmMaxAgeOfOldestMessage = Duration.hours(1);
const maxConcurrencyForSftpOperations = 4;
const apiUrlEnvVarName = "API_URL";

interface SurescriptsSettings {
  sendPatientRequest: QueueAndLambdaSettings;
  sendBatchRequest: QueueAndLambdaSettings;
  receiveVerification: QueueAndLambdaSettings;
  receiveResponse: QueueAndLambdaSettings;
}

const sftpActionSettings: LambdaSettings = {
  name: "SurescriptsSftpAction",
  entry: "surescripts-sftp-action",
  lambda: {
    memory: 1024,
    timeout: sftpActionTimeout,
  },
};

const settings: SurescriptsSettings = {
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
      maxConcurrency: maxConcurrencyForSftpOperations,
    },
    waitTime: Duration.seconds(0),
  },
  sendBatchRequest: {
    name: "SurescriptsSendBatchRequest",
    entry: "surescripts-send-batch-request",
    lambda: {
      memory: 1024,
      timeout: sendBatchRequestLambdaTimeout,
    },
    queue: {
      alarmMaxAgeOfOldestMessage,
      maxMessageCountAlarmThreshold: 15_000,
      maxReceiveCount: 3,
      visibilityTimeout: Duration.seconds(sendBatchRequestLambdaTimeout.toSeconds() * 2 + 1),
      createRetryLambda: false,
    },
    eventSource: {
      batchSize: 1,
      reportBatchItemFailures: true,
      maxConcurrency: maxConcurrencyForSftpOperations,
    },
    waitTime: Duration.seconds(0),
  },
  receiveVerification: {
    name: "SurescriptsReceiveVerification",
    entry: "surescripts-receive-verification",
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
      maxConcurrency: maxConcurrencyForSftpOperations,
    },
    waitTime: Duration.seconds(0),
  },
  receiveResponse: {
    name: "SurescriptsReceiveResponse",
    entry: "surescripts-receive-response",
    lambda: {
      memory: 1024,
      timeout: receiveResponseLambdaTimeout,
    },
    queue: {
      alarmMaxAgeOfOldestMessage,
      maxMessageCountAlarmThreshold: 15_000,
      maxReceiveCount: 3,
      visibilityTimeout: Duration.seconds(receiveResponseLambdaTimeout.toSeconds() * 2 + 1),
      createRetryLambda: false,
    },
    eventSource: {
      batchSize: 1,
      reportBatchItemFailures: true,
      maxConcurrency: maxConcurrencyForSftpOperations,
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
  private readonly sftpActionLambda: Lambda;
  private readonly sendPatientRequestLambda: Lambda;
  private readonly sendPatientRequestQueue: Queue;
  private readonly sendBatchRequestLambda: Lambda;
  private readonly sendBatchRequestQueue: Queue;
  private readonly receiveVerificationLambda: Lambda;
  private readonly receiveVerificationQueue: Queue;
  private readonly receiveResponseLambda: Lambda;
  private readonly receiveResponseQueue: Queue;
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

    const sftpAction = this.setupLambda(sftpActionSettings, {
      ...commonConfig,
      surescriptsReplicaBucket: this.surescriptsReplicaBucket,
    });
    this.sftpActionLambda = sftpAction.lambda;

    const sendPatientRequest = this.setupLambdaAndQueue("sendPatientRequest", {
      ...commonConfig,
      surescriptsReplicaBucket: this.surescriptsReplicaBucket,
    });
    this.sendPatientRequestLambda = sendPatientRequest.lambda;
    this.sendPatientRequestQueue = sendPatientRequest.queue;

    const sendBatchRequest = this.setupLambdaAndQueue("sendBatchRequest", {
      ...commonConfig,
      surescriptsReplicaBucket: this.surescriptsReplicaBucket,
    });
    this.sendBatchRequestLambda = sendBatchRequest.lambda;
    this.sendBatchRequestQueue = sendBatchRequest.queue;

    const receiveVerification = this.setupLambdaAndQueue("receiveVerification", {
      ...commonConfig,
      surescriptsReplicaBucket: this.surescriptsReplicaBucket,
    });
    this.receiveVerificationLambda = receiveVerification.lambda;
    this.receiveVerificationQueue = receiveVerification.queue;

    const receiveResponse = this.setupLambdaAndQueue("receiveResponse", {
      ...commonConfig,
      surescriptsReplicaBucket: this.surescriptsReplicaBucket,
      pharmacyConversionBucket: this.pharmacyConversionBucket,
    });
    this.receiveResponseLambda = receiveResponse.lambda;
    this.receiveResponseQueue = receiveResponse.queue;

    for (const secret of secrets) {
      secret.grantRead(this.sftpActionLambda);
      secret.grantRead(this.sendPatientRequestLambda);
      secret.grantRead(this.sendBatchRequestLambda);
      secret.grantRead(this.receiveVerificationLambda);
      secret.grantRead(this.receiveResponseLambda);
    }
  }

  getAssets(): SurescriptsAssets {
    return {
      sftpActionLambda: this.sftpActionLambda,
      sendPatientRequestLambda: this.sendPatientRequestLambda,
      sendPatientRequestQueue: this.sendPatientRequestQueue,
      sendBatchRequestLambda: this.sendBatchRequestLambda,
      sendBatchRequestQueue: this.sendBatchRequestQueue,
      receiveVerificationLambda: this.receiveVerificationLambda,
      receiveVerificationQueue: this.receiveVerificationQueue,
      receiveResponseLambda: this.receiveResponseLambda,
      receiveResponseQueue: this.receiveResponseQueue,
      surescriptsReplicaBucket: this.surescriptsReplicaBucket,
      pharmacyConversionBucket: this.pharmacyConversionBucket,
    };
  }

  setApiUrl(apiUrl: string): void {
    const lambdasToSetApiUrl = [
      this.sftpActionLambda,
      this.sendPatientRequestLambda,
      this.sendBatchRequestLambda,
      this.receiveVerificationLambda,
      this.receiveResponseLambda,
    ];
    lambdasToSetApiUrl.forEach(lambda => lambda.addEnvironment(apiUrlEnvVarName, apiUrl));
  }

  private setupLambda(
    settings: LambdaSettings,
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
  ) {
    const { name, entry, lambda: lambdaSettings } = settings;

    const {
      lambdaLayers,
      vpc,
      envType,
      envVars,
      sentryDsn,
      alarmAction,
      systemRootOID,
      surescriptsReplicaBucket,
    } = props;

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

    return { lambda };
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
