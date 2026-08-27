import { Duration, NestedStack, NestedStackProps } from "aws-cdk-lib";
import { SnsAction } from "aws-cdk-lib/aws-cloudwatch-actions";
import * as dynamodb from "aws-cdk-lib/aws-dynamodb";
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
import { LambdaSettingsWithNameAndEntry, QueueAndLambdaSettings } from "../shared/settings";
import { createQueue } from "../shared/sqs";
import { QuestAssets } from "./types";
import { createBucket } from "../shared/bucket";

const sftpActionTimeout = Duration.seconds(30);
const rosterUploadLambdaTimeout = Duration.minutes(5);
const ingestAllResponsesLambdaTimeout = Duration.minutes(15);
const convertPatientResponseAlarmMaxAgeOfOldestMessage = Duration.minutes(30);
const convertPatientResponseLambdaTimeout = Duration.minutes(15);
const convertPatientResponseMaxConcurrency = 50;

interface Settings {
  sftpAction: LambdaSettingsWithNameAndEntry;
  rosterUpload: LambdaSettingsWithNameAndEntry;
  ingestAllResponses: LambdaSettingsWithNameAndEntry;
  convertPatientResponse: QueueAndLambdaSettings;
}

const settings: Settings = {
  sftpAction: {
    name: "QuestSftpAction",
    entry: "quest/sftp-action",
    lambda: {
      memory: 1024,
      timeout: sftpActionTimeout,
    },
  },
  rosterUpload: {
    name: "QuestUploadRoster",
    entry: "quest/upload-roster",
    lambda: {
      memory: 1024,
      timeout: rosterUploadLambdaTimeout,
    },
  },
  ingestAllResponses: {
    name: "QuestIngestAllResponses",
    entry: "quest/ingest-all-responses",
    lambda: {
      memory: 2048,
      timeout: ingestAllResponsesLambdaTimeout,
    },
  },
  convertPatientResponse: {
    name: "QuestConvertPatientResponse",
    entry: "quest/convert-patient-response",
    lambda: {
      memory: 1024,
      timeout: convertPatientResponseLambdaTimeout,
    },
    queue: {
      alertMaxApproximateAgeOfOldestMessage: convertPatientResponseAlarmMaxAgeOfOldestMessage,
      alertMaxApproximateNumberOfMessagesVisible: 15_000,
      maxReceiveCount: 1,
      visibilityTimeout: Duration.seconds(convertPatientResponseLambdaTimeout.toSeconds() * 2 + 1),
      createRetryLambda: false,
    },
    eventSource: {
      batchSize: 1,
      reportBatchItemFailures: true,
      maxConcurrency: convertPatientResponseMaxConcurrency,
    },
    waitTime: Duration.seconds(0),
  },
};

function questEnvironmentVariablesAndSecrets({
  nestedStack,
  quest,
  questReplicaBucket,
  labConversionBucket,
  featureFlagsTableName,
}: {
  nestedStack: QuestNestedStack;
  quest: EnvConfig["quest"];
  questReplicaBucket: s3.Bucket;
  labConversionBucket: s3.Bucket;
  featureFlagsTableName: string;
}): { envVars: Record<string, string>; secrets: secret.ISecret[] } {
  if (!quest) {
    return { envVars: {}, secrets: [] };
  }

  const envVars: Record<string, string> = {
    QUEST_SFTP_HOST: quest.questHostname,
    QUEST_SFTP_USERNAME: quest.questUsername,
    QUEST_SFTP_PORT: quest.questPort.toString(),
    QUEST_REPLICA_BUCKET_NAME: questReplicaBucket.bucketName,
    LAB_CONVERSION_BUCKET_NAME: labConversionBucket.bucketName,
    QUEST_INCOMING_DIRECTORY_PATH: quest.questIncomingDirectoryPath,
    QUEST_OUTGOING_DIRECTORY_PATH: quest.questOutgoingDirectoryPath,
    FEATURE_FLAGS_TABLE_NAME: featureFlagsTableName,
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
  alertAction?: SnsAction;
  lambdaLayers: LambdaLayers;
  featureFlagsTable: dynamodb.Table;
}

export class QuestNestedStack extends NestedStack {
  private readonly sftpActionLambda: Lambda;
  private readonly uploadRosterLambda: Lambda;
  private readonly ingestAllResponsesLambda: Lambda;
  private readonly convertPatientResponseLambda: Lambda;
  private readonly convertPatientResponseQueue: Queue;
  private readonly questReplicaBucket: s3.Bucket;
  private readonly labConversionBucket: s3.Bucket;

  constructor(scope: Construct, id: string, props: QuestNestedStackProps) {
    super(scope, id, props);

    this.terminationProtection = true;
    const questReplicaBucketBucketName = props.config.questReplicaBucketName;
    if (!questReplicaBucketBucketName) throw new Error("questReplicaBucketBucketName is required");
    this.questReplicaBucket = createBucket(
      this,
      {
        bucketName: questReplicaBucketBucketName,
        versioned: true,
      },
      "QuestReplicaBucket"
    );

    const labConversionBucketBucketName = props.config.labConversionBucketName;
    if (!labConversionBucketBucketName)
      throw new Error("labConversionBucketBucketName is required");
    this.labConversionBucket = createBucket(
      this,
      {
        bucketName: labConversionBucketBucketName,
        versioned: true,
        // Required for presigned URLs
        cors: [
          {
            allowedOrigins: ["*"],
            allowedMethods: [s3.HttpMethods.GET],
          },
        ],
      },
      "LabConversionBucket"
    );

    const { envVars, secrets } = questEnvironmentVariablesAndSecrets({
      nestedStack: this,
      quest: props.config.quest,
      questReplicaBucket: this.questReplicaBucket,
      labConversionBucket: this.labConversionBucket,
      featureFlagsTableName: props.featureFlagsTable.tableName,
    });

    const commonConfig = {
      lambdaLayers: props.lambdaLayers,
      vpc: props.vpc,
      envType: props.config.environmentType,
      sentryDsn: props.config.lambdasSentryDSN,
      alertAction: props.alertAction,
      quest: props.config.quest,
      systemRootOID: props.config.systemRootOID,
      termServerUrl: props.config.termServerUrl,
      envVars,
      secrets,
    };

    this.sftpActionLambda = this.setupLambda("sftpAction", {
      ...commonConfig,
      questReplicaBucket: this.questReplicaBucket,
      labConversionBucket: this.labConversionBucket,
      featureFlagsTable: props.featureFlagsTable,
    });

    this.uploadRosterLambda = this.setupLambda("rosterUpload", {
      ...commonConfig,
      questReplicaBucket: this.questReplicaBucket,
      labConversionBucket: this.labConversionBucket,
      featureFlagsTable: props.featureFlagsTable,
    });

    const { lambda: convertPatientResponseLambda, queue: convertPatientResponseQueue } =
      this.setupLambdaAndQueue(settings.convertPatientResponse, {
        ...commonConfig,
        questReplicaBucket: this.questReplicaBucket,
        labConversionBucket: this.labConversionBucket,
        featureFlagsTable: props.featureFlagsTable,
      });
    this.convertPatientResponseLambda = convertPatientResponseLambda;
    this.convertPatientResponseQueue = convertPatientResponseQueue;

    this.ingestAllResponsesLambda = this.setupLambda("ingestAllResponses", {
      ...commonConfig,
      questReplicaBucket: this.questReplicaBucket,
      labConversionBucket: this.labConversionBucket,
      queues: [
        {
          envVarName: "QUEST_CONVERT_PATIENT_RESPONSE_QUEUE_URL",
          queue: this.convertPatientResponseQueue,
        },
      ],
      featureFlagsTable: props.featureFlagsTable,
    });
  }

  getLambdas(): Lambda[] {
    return [
      this.sftpActionLambda,
      this.uploadRosterLambda,
      this.ingestAllResponsesLambda,
      this.convertPatientResponseLambda,
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
          envVarName: "QUEST_UPLOAD_ROSTER_LAMBDA_NAME",
          lambda: this.uploadRosterLambda,
        },
        {
          envVarName: "QUEST_INGEST_ALL_RESPONSES_LAMBDA_NAME",
          lambda: this.ingestAllResponsesLambda,
        },
        {
          envVarName: "QUEST_CONVERT_PATIENT_RESPONSE_LAMBDA_NAME",
          lambda: this.convertPatientResponseLambda,
        },
      ],
      questQueues: [
        {
          envVarName: "QUEST_CONVERT_PATIENT_RESPONSE_QUEUE_URL",
          queue: this.convertPatientResponseQueue,
        },
      ],
      sftpActionLambda: this.sftpActionLambda,
      rosterUploadLambda: this.uploadRosterLambda,
      ingestAllResponsesLambda: this.ingestAllResponsesLambda,
      convertPatientResponseLambda: this.convertPatientResponseLambda,
      convertPatientResponseQueue: this.convertPatientResponseQueue,
      questReplicaBucket: this.questReplicaBucket,
      labConversionBucket: this.labConversionBucket,
    };
  }

  private setupLambda<T extends keyof Settings>(
    job: T,
    props: {
      lambdaLayers: LambdaLayers;
      vpc: ec2.IVpc;
      envType: EnvType;
      envVars: Record<string, string>;
      sentryDsn: string | undefined;
      alertAction: SnsAction | undefined;
      systemRootOID: string;
      questReplicaBucket: s3.Bucket;
      labConversionBucket?: s3.Bucket;
      termServerUrl?: string;
      secrets: secret.ISecret[];
      lambdas?: {
        envVarName: string;
        lambda: Lambda;
      }[];
      queues?: {
        envVarName: string;
        queue: Queue;
      }[];
      featureFlagsTable: dynamodb.Table;
    }
  ): Lambda {
    const { name, entry, lambda: lambdaSettings } = settings[job];

    const {
      lambdaLayers,
      vpc,
      envType,
      envVars,
      sentryDsn,
      alertAction,
      systemRootOID,
      questReplicaBucket,
      labConversionBucket,
      termServerUrl,
      secrets,
      lambdas,
      queues,
      featureFlagsTable,
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
        ...(termServerUrl ? { TERM_SERVER_URL: termServerUrl } : {}),
        ...(lambdas ?? []).reduce((acc, lambda) => {
          acc[lambda.envVarName] = lambda.lambda.functionName;
          return acc;
        }, {} as Record<string, string>),
        ...(queues ?? []).reduce((acc, queue) => {
          acc[queue.envVarName] = queue.queue.queueUrl;
          return acc;
        }, {} as Record<string, string>),
        SYSTEM_ROOT_OID: systemRootOID,
      },
      layers: [lambdaLayers.shared],
      vpc,
      alertSnsAction: alertAction,
    });

    questReplicaBucket.grantReadWrite(lambda);
    labConversionBucket?.grantReadWrite(lambda);
    featureFlagsTable.grantReadData(lambda);

    for (const secret of secrets) {
      secret.grantRead(lambda);
    }

    for (const grantedLambda of lambdas ?? []) {
      grantedLambda.lambda.grantInvoke(lambda);
    }

    for (const grantedQueue of queues ?? []) {
      grantedQueue.queue.grantSendMessages(lambda);
    }

    return lambda;
  }

  private setupLambdaAndQueue(
    {
      name,
      entry,
      lambda: lambdaSettings,
      queue: queueSettings,
      eventSource: eventSourceSettings,
    }: QueueAndLambdaSettings,
    props: {
      lambdaLayers: LambdaLayers;
      vpc: ec2.IVpc;
      envType: EnvType;
      envVars: Record<string, string>;
      sentryDsn: string | undefined;
      alertAction: SnsAction | undefined;
      systemRootOID: string;
      questReplicaBucket: s3.Bucket;
      labConversionBucket?: s3.Bucket;
      termServerUrl?: string;
      secrets: secret.ISecret[];
      featureFlagsTable: dynamodb.Table;
    }
  ): { lambda: Lambda; queue: Queue } {
    const {
      lambdaLayers,
      vpc,
      envType,
      envVars,
      sentryDsn,
      alertAction,
      systemRootOID,
      questReplicaBucket,
      labConversionBucket,
      termServerUrl,
      secrets,
      featureFlagsTable,
    } = props;

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
      stack: this,
      name,
      entry,
      envType,
      envVars: {
        ...envVars,
        ...(sentryDsn ? { SENTRY_DSN: sentryDsn } : {}),
        ...(termServerUrl ? { TERM_SERVER_URL: termServerUrl } : {}),
        SYSTEM_ROOT_OID: systemRootOID,
      },
      layers: [lambdaLayers.shared],
      vpc,
      alertSnsAction: alertAction,
    });

    for (const secret of secrets) {
      secret.grantRead(lambda);
    }

    questReplicaBucket.grantReadWrite(lambda);
    labConversionBucket?.grantReadWrite(lambda);
    featureFlagsTable.grantReadData(lambda);

    lambda.addEventSource(new SqsEventSource(queue, eventSourceSettings));

    return { lambda, queue };
  }
}
