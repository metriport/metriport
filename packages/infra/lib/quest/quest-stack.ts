import { Duration, NestedStack, NestedStackProps } from "aws-cdk-lib";
import { SnsAction } from "aws-cdk-lib/aws-cloudwatch-actions";
import * as ec2 from "aws-cdk-lib/aws-ec2";
import { Function as Lambda } from "aws-cdk-lib/aws-lambda";
import { SqsEventSource } from "aws-cdk-lib/aws-lambda-event-sources";
import * as s3 from "aws-cdk-lib/aws-s3";
import * as secret from "aws-cdk-lib/aws-secretsmanager";
import { Queue } from "aws-cdk-lib/aws-sqs";
import { Construct } from "constructs";
import { EnvConfig } from "../../config/env-config";
import { EnvType } from "../env-type";
import { createLambda } from "../shared/lambda";
import { LambdaLayers } from "../shared/lambda-layers";
import { buildSecret } from "../shared/secrets";
import { LambdaSettings, QueueAndLambdaSettings } from "../shared/settings";
import { createQueue } from "../shared/sqs";
import { QuestAssets } from "./types";

const sftpActionTimeout = Duration.seconds(30);
const sendPatientRequestLambdaTimeout = Duration.seconds(30);
const sendBatchRequestLambdaTimeout = Duration.minutes(5);
const receiveResponseLambdaTimeout = Duration.seconds(30);
const convertPatientResponseLambdaTimeout = Duration.seconds(30);
const convertBatchResponseLambdaTimeout = Duration.minutes(5);
const alarmMaxAgeOfOldestMessage = Duration.hours(1);

interface QuestSettings {
  sendPatientRequest: QueueAndLambdaSettings;
  sendBatchRequest: QueueAndLambdaSettings;
  receiveResponse: QueueAndLambdaSettings;
}

interface QuestLambdaSettings {
  sftpAction: LambdaSettings;
  convertPatientResponse: LambdaSettings;
  convertBatchResponse: LambdaSettings;
}

const settings: QuestSettings = {
  sendPatientRequest: {
    name: "QuestSendPatientRequest",
    entry: "quest/send-patient-request",
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
    },
    waitTime: Duration.seconds(0),
  },
  sendBatchRequest: {
    name: "QuestSendBatchRequest",
    entry: "quest/send-batch-request",
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
    },
    waitTime: Duration.seconds(0),
  },
  receiveResponse: {
    name: "QuestReceiveResponse",
    entry: "quest/receive-response",
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
      maxConcurrency: 100,
    },
    waitTime: Duration.seconds(0),
  },
};

const questLambdaSettings: QuestLambdaSettings = {
  sftpAction: {
    name: "QuestSftpAction",
    entry: "quest/sftp-action",
    lambda: {
      memory: 1024,
      timeout: sftpActionTimeout,
    },
  },
  convertPatientResponse: {
    name: "QuestConvertPatientResponse",
    entry: "quest/convert-patient-response",
    lambda: {
      memory: 1024,
      timeout: convertPatientResponseLambdaTimeout,
    },
  },
  convertBatchResponse: {
    name: "QuestConvertBatchResponse",
    entry: "quest/convert-batch-response",
    lambda: {
      memory: 1024,
      timeout: convertBatchResponseLambdaTimeout,
    },
  },
};

function questEnvironmentVariablesAndSecrets({
  nestedStack,
  quest,
  questReplicaBucket,
  labConversionBucket,
}: {
  nestedStack: QuestNestedStack;
  quest: EnvConfig["quest"];
  questReplicaBucket: s3.Bucket;
  labConversionBucket: s3.Bucket;
}): { envVars: Record<string, string>; secrets: secret.ISecret[] } {
  if (!quest) {
    return { envVars: {}, secrets: [] };
  }

  const envVars: Record<string, string> = {
    QUEST_SFTP_HOST: quest.questHostname,
    QUEST_SFTP_USERNAME: quest.questUsername,
    QUEST_REPLICA_BUCKET_NAME: questReplicaBucket.bucketName,
    LAB_CONVERSION_BUCKET_NAME: labConversionBucket.bucketName,
  };

  const secrets: secret.ISecret[] = [];
  const senderPasswordSecret = buildSecret(nestedStack, quest.secrets.QUEST_SFTP_PASSWORD);
  envVars.QUEST_SFTP_PASSWORD_NAME = senderPasswordSecret.secretName;
  secrets.push(senderPasswordSecret);
  return { envVars, secrets };
}

interface QuestNestedStackProps extends NestedStackProps {
  config: EnvConfig;
  vpc: ec2.IVpc;
  alarmAction?: SnsAction;
  lambdaLayers: LambdaLayers;
}

export class QuestNestedStack extends NestedStack {
  private readonly sftpActionLambda: Lambda;
  private readonly convertPatientResponseLambda: Lambda;
  private readonly convertBatchResponseLambda: Lambda;
  private readonly sendPatientRequestLambda: Lambda;
  private readonly sendPatientRequestQueue: Queue;
  private readonly sendBatchRequestLambda: Lambda;
  private readonly sendBatchRequestQueue: Queue;
  private readonly receiveResponseLambda: Lambda;
  private readonly receiveResponseQueue: Queue;
  private readonly questReplicaBucket: s3.Bucket;
  private readonly labConversionBucket: s3.Bucket;

  constructor(scope: Construct, id: string, props: QuestNestedStackProps) {
    super(scope, id, props);

    this.terminationProtection = true;

    this.questReplicaBucket = new s3.Bucket(this, "QuestReplicaBucket", {
      bucketName: props.config.questReplicaBucketName,
      publicReadAccess: false,
      encryption: s3.BucketEncryption.S3_MANAGED,
      versioned: true,
    });

    this.labConversionBucket = new s3.Bucket(this, "LabConversionBucket", {
      bucketName: props.config.labConversionBucketName,
      publicReadAccess: false,
      encryption: s3.BucketEncryption.S3_MANAGED,
      versioned: true,
    });

    const { envVars, secrets } = questEnvironmentVariablesAndSecrets({
      nestedStack: this,
      quest: props.config.quest,
      questReplicaBucket: this.questReplicaBucket,
      labConversionBucket: this.labConversionBucket,
    });

    const commonConfig = {
      lambdaLayers: props.lambdaLayers,
      vpc: props.vpc,
      envType: props.config.environmentType,
      sentryDsn: props.config.lambdasSentryDSN,
      alarmAction: props.alarmAction,
      quest: props.config.quest,
      systemRootOID: props.config.systemRootOID,
      envVars,
    };

    const sftpAction = this.setupLambda("sftpAction", {
      ...commonConfig,
      questReplicaBucket: this.questReplicaBucket,
      labConversionBucket: this.labConversionBucket,
    });
    this.sftpActionLambda = sftpAction.lambda;

    const convertPatientResponse = this.setupLambda("convertPatientResponse", {
      ...commonConfig,
      questReplicaBucket: this.questReplicaBucket,
      labConversionBucket: this.labConversionBucket,
    });
    this.convertPatientResponseLambda = convertPatientResponse.lambda;

    const convertBatchResponse = this.setupLambda("convertBatchResponse", {
      ...commonConfig,
      questReplicaBucket: this.questReplicaBucket,
      labConversionBucket: this.labConversionBucket,
    });
    this.convertBatchResponseLambda = convertBatchResponse.lambda;

    const sendPatientRequest = this.setupLambdaAndQueue("sendPatientRequest", {
      ...commonConfig,
      questReplicaBucket: this.questReplicaBucket,
    });
    this.sendPatientRequestLambda = sendPatientRequest.lambda;
    this.sendPatientRequestQueue = sendPatientRequest.queue;

    const sendBatchRequest = this.setupLambdaAndQueue("sendBatchRequest", {
      ...commonConfig,
      questReplicaBucket: this.questReplicaBucket,
    });
    this.sendBatchRequestLambda = sendBatchRequest.lambda;
    this.sendBatchRequestQueue = sendBatchRequest.queue;

    const receiveResponse = this.setupLambdaAndQueue("receiveResponse", {
      ...commonConfig,
      questReplicaBucket: this.questReplicaBucket,
      labConversionBucket: this.labConversionBucket,
    });
    this.receiveResponseLambda = receiveResponse.lambda;
    this.receiveResponseQueue = receiveResponse.queue;

    const lambdas = this.getLambdas();
    for (const secret of secrets) {
      for (const lambda of lambdas) {
        secret.grantRead(lambda);
      }
    }
  }

  getLambdas(): Lambda[] {
    return [
      this.sftpActionLambda,
      this.sendPatientRequestLambda,
      this.sendBatchRequestLambda,
      this.receiveResponseLambda,
      this.convertPatientResponseLambda,
      this.convertBatchResponseLambda,
    ];
  }

  getAssets(): QuestAssets {
    return {
      questLambdas: [
        {
          envVarName: "QUEST_SFTP_ACTION_LAMBDA_NAME",
          lambda: this.sftpActionLambda,
        },
        {
          envVarName: "QUEST_CONVERT_PATIENT_RESPONSE_LAMBDA_NAME",
          lambda: this.convertPatientResponseLambda,
        },
        {
          envVarName: "QUEST_CONVERT_BATCH_RESPONSE_LAMBDA_NAME",
          lambda: this.convertBatchResponseLambda,
        },
      ],
      questQueues: [
        {
          envVarName: "QUEST_SEND_PATIENT_REQUEST_QUEUE_URL",
          queue: this.sendPatientRequestQueue,
        },
        {
          envVarName: "QUEST_SEND_BATCH_REQUEST_QUEUE_URL",
          queue: this.sendBatchRequestQueue,
        },
        {
          envVarName: "QUEST_RECEIVE_RESPONSE_QUEUE_URL",
          queue: this.receiveResponseQueue,
        },
      ],
      sftpActionLambda: this.sftpActionLambda,
      sendPatientRequestLambda: this.sendPatientRequestLambda,
      sendPatientRequestQueue: this.sendPatientRequestQueue,
      sendBatchRequestLambda: this.sendBatchRequestLambda,
      sendBatchRequestQueue: this.sendBatchRequestQueue,
      receiveResponseLambda: this.receiveResponseLambda,
      receiveResponseQueue: this.receiveResponseQueue,
      convertPatientResponseLambda: this.convertPatientResponseLambda,
      convertBatchResponseLambda: this.convertBatchResponseLambda,
      questReplicaBucket: this.questReplicaBucket,
      labConversionBucket: this.labConversionBucket,
    };
  }

  private setupLambda<T extends keyof QuestLambdaSettings>(
    job: T,
    props: {
      lambdaLayers: LambdaLayers;
      vpc: ec2.IVpc;
      envType: EnvType;
      envVars: Record<string, string>;
      sentryDsn: string | undefined;
      alarmAction: SnsAction | undefined;
      systemRootOID: string;
      questReplicaBucket: s3.Bucket;
      labConversionBucket: s3.Bucket;
    }
  ) {
    const { name, entry, lambda: lambdaSettings } = questLambdaSettings[job];

    const {
      lambdaLayers,
      vpc,
      envType,
      envVars,
      sentryDsn,
      alarmAction,
      systemRootOID,
      questReplicaBucket,
      labConversionBucket,
    } = props;

    const lambda = createLambda({
      ...lambdaSettings,
      stack: this,
      name,
      entry,
      envType,
      envVars: {
        ...envVars,
        ...(sentryDsn ? { SENTRY_DSN: sentryDsn } : {}),
        ...(job === "sftpAction" ? { SFTP_ACTION_LAMBDA: "quest" } : {}),
        SYSTEM_ROOT_OID: systemRootOID,
      },
      layers: [lambdaLayers.shared],
      vpc,
      alarmSnsAction: alarmAction,
    });

    questReplicaBucket.grantReadWrite(lambda);
    labConversionBucket.grantReadWrite(lambda);

    return { lambda };
  }

  private setupLambdaAndQueue<T extends keyof QuestSettings>(
    job: T,
    props: {
      lambdaLayers: LambdaLayers;
      vpc: ec2.IVpc;
      envType: EnvType;
      envVars: Record<string, string>;
      sentryDsn: string | undefined;
      alarmAction: SnsAction | undefined;
      systemRootOID: string;
      questReplicaBucket: s3.Bucket;
      labConversionBucket?: s3.Bucket;
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
      questReplicaBucket,
      labConversionBucket,
    } = props;

    const {
      name,
      entry,
      lambda: lambdaSettings,
      queue: queueSettings,
      eventSource: eventSourceSettings,
    } = settings[job];

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
        SYSTEM_ROOT_OID: systemRootOID,
      },
      layers: [lambdaLayers.shared],
      vpc,
      alarmSnsAction: alarmAction,
    });

    questReplicaBucket.grantReadWrite(lambda);
    labConversionBucket?.grantReadWrite(lambda);

    lambda.addEventSource(new SqsEventSource(queue, eventSourceSettings));

    return { lambda, queue };
  }
}
