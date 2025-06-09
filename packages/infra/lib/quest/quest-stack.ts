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
import { QuestAssets } from "./types";

const sftpActionTimeout = Duration.minutes(5);
const sftpActionWaitTime = Duration.seconds(1);
const sendRequestLambdaTimeout = Duration.seconds(30);
const receiveResponseLambdaTimeout = Duration.seconds(30);
const alarmMaxAgeOfOldestMessage = Duration.hours(1);
const maxConcurrencyForSftpOperations = 2;
const maxConcurrencyForFileOperations = 4;
const apiUrlEnvVarName = "API_URL";

interface QuestSettings {
  sftpAction: QueueAndLambdaSettings;
  sendRequest: QueueAndLambdaSettings;
  receiveResponse: QueueAndLambdaSettings;
}

const settings: QuestSettings = {
  sftpAction: {
    name: "QuestSftpAction",
    entry: "quest-sftp-action",
    lambda: {
      memory: 1024,
      timeout: sftpActionTimeout,
    },
    queue: {
      alarmMaxAgeOfOldestMessage,
      maxMessageCountAlarmThreshold: 1000,
      maxReceiveCount: 3,
      visibilityTimeout: Duration.seconds(sftpActionTimeout.toSeconds() * 2 + 1),
      createRetryLambda: false,
    },
    eventSource: {
      batchSize: 1,
      reportBatchItemFailures: true,
      maxConcurrency: maxConcurrencyForSftpOperations,
    },
    waitTime: sftpActionWaitTime,
  },

  sendRequest: {
    name: "QuestSendRequest",
    entry: "quest-send-request",
    lambda: {
      memory: 1024,
      timeout: sendRequestLambdaTimeout,
    },
    queue: {
      alarmMaxAgeOfOldestMessage,
      maxMessageCountAlarmThreshold: 15_000,
      maxReceiveCount: 3,
      visibilityTimeout: Duration.seconds(sendRequestLambdaTimeout.toSeconds() * 2 + 1),
      createRetryLambda: false,
    },
    eventSource: {
      batchSize: 1,
      reportBatchItemFailures: true,
      maxConcurrency: maxConcurrencyForFileOperations,
    },
    waitTime: Duration.seconds(0),
  },
  receiveResponse: {
    name: "QuestReceiveResponse",
    entry: "quest-receive-response",
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
      maxConcurrency: maxConcurrencyForFileOperations,
    },
    waitTime: Duration.seconds(0),
  },
};

function questEnvironmentVariablesAndSecrets({
  nestedStack,
  quest,
  questReplicaBucket,
  labConversionBucket,
}: {
  nestedStack: SurescriptsNestedStack;
  quest: EnvConfig["quest"];
  questReplicaBucket: s3.Bucket;
  labConversionBucket: s3.Bucket;
}): { envVars: Record<string, string>; secrets: secret.ISecret[] } {
  if (!quest) {
    return { envVars: {}, secrets: [] };
  }

  const envVars: Record<string, string> = {
    QUEST_SFTP_HOST: quest.questHost,
    QUEST_SFTP_PORT: quest.questPort.toString(),
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
  private readonly sftpActionQueue: Queue;
  private readonly sendRequestLambda: Lambda;
  private readonly sendRequestQueue: Queue;
  private readonly receiveResponseLambda: Lambda;
  private readonly receiveResponseQueue: Queue;
  private readonly questReplicaBucket: s3.Bucket;
  private readonly labConversionBucket: s3.Bucket;

  constructor(scope: Construct, id: string, props: SurescriptsNestedStackProps) {
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
      surescripts: props.config.surescripts,
      systemRootOID: props.config.systemRootOID,
      envVars,
    };

    const sftpAction = this.setupLambdaAndQueue("sftpAction", {
      ...commonConfig,
      questReplicaBucket: this.questReplicaBucket,
    });
    this.sftpActionLambda = sftpAction.lambda;
    this.sftpActionQueue = sftpAction.queue;

    const sendRequest = this.setupLambdaAndQueue("sendRequest", {
      ...commonConfig,
      questReplicaBucket: this.questReplicaBucket,
    });
    this.sendRequestLambda = sendRequest.lambda;
    this.sendRequestQueue = sendRequest.queue;

    const receiveResponse = this.setupLambdaAndQueue("receiveResponse", {
      ...commonConfig,
      questReplicaBucket: this.questReplicaBucket,
    });
    this.receiveResponseLambda = receiveResponse.lambda;
    this.receiveResponseQueue = receiveResponse.queue;

    for (const secret of secrets) {
      secret.grantRead(this.sftpActionLambda);
      secret.grantRead(this.sendRequestLambda);
      secret.grantRead(this.receiveResponseLambda);
    }
  }

  getAssets(): QuestAssets {
    return {
      sftpActionLambda: this.sftpActionLambda,
      sftpActionQueue: this.sftpActionQueue,
      sendRequestLambda: this.sendRequestLambda,
      sendRequestQueue: this.sendRequestQueue,
      receiveResponseLambda: this.receiveResponseLambda,
      receiveResponseQueue: this.receiveResponseQueue,
      questReplicaBucket: this.questReplicaBucket,
      labConversionBucket: this.labConversionBucket,
    };
  }

  setApiUrl(apiUrl: string): void {
    const lambdasToSetApiUrl = [
      this.sftpActionLambda,
      this.sendRequestLambda,
      this.receiveResponseLambda,
    ];
    lambdasToSetApiUrl.forEach(lambda => lambda.addEnvironment(apiUrlEnvVarName, apiUrl));
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

    questReplicaBucket.grantReadWrite(lambda);
    labConversionBucket?.grantReadWrite(lambda);

    lambda.addEventSource(
      new SqsEventSource(queue, {
        ...eventSourceSettings,
        maxBatchingWindow: waitTime,
      })
    );

    return { lambda, queue };
  }
}
