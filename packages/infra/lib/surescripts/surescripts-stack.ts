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
import { createBucket } from "../shared/bucket";
import { createLambda } from "../shared/lambda";
import { LambdaLayers } from "../shared/lambda-layers";
import { buildSecret } from "../shared/secrets";
import { LambdaSettingsWithNameAndEntry, QueueAndLambdaSettings } from "../shared/settings";
import { createQueue } from "../shared/sqs";
import { SurescriptsAssets } from "./types";

const sftpActionTimeout = Duration.seconds(30);
const rosterUploadLambdaTimeout = Duration.minutes(5);
const ingestAllLambdaTimeout = Duration.minutes(15);
const convertBatchResponseAlertMaxAgeOfOldestMessage = Duration.minutes(10);
const convertBatchResponseLambdaTimeout = Duration.minutes(15);
const convertBatchResponseMaxConcurrency = 10;
const convertPatientResponseAlertMaxAgeOfOldestMessage = Duration.minutes(30);
const convertPatientResponseLambdaTimeout = Duration.minutes(15);
const convertPatientResponseMaxConcurrency = 50;

interface Settings {
  sftpAction: LambdaSettingsWithNameAndEntry;
  rosterUpload: LambdaSettingsWithNameAndEntry;
  ingestAllResponses: LambdaSettingsWithNameAndEntry;
  convertBatchResponse: QueueAndLambdaSettings;
  convertPatientResponse: QueueAndLambdaSettings;
}

const settings: Settings = {
  sftpAction: {
    name: "SurescriptsSftpAction",
    entry: "surescripts/sftp-action",
    lambda: {
      memory: 1024,
      timeout: sftpActionTimeout,
    },
  },
  rosterUpload: {
    name: "SurescriptsUploadRoster",
    entry: "surescripts/upload-roster",
    lambda: {
      memory: 1024,
      timeout: rosterUploadLambdaTimeout,
    },
  },
  ingestAllResponses: {
    name: "SurescriptsIngestAllResponses",
    entry: "surescripts/ingest-all-responses",
    lambda: {
      memory: 1024,
      timeout: ingestAllLambdaTimeout,
    },
  },
  convertBatchResponse: {
    name: "SurescriptsConvertBatchResponse",
    entry: "surescripts/convert-batch-response",
    lambda: {
      memory: 1024,
      timeout: convertBatchResponseLambdaTimeout,
    },
    queue: {
      alertMaxApproximateAgeOfOldestMessage: convertBatchResponseAlertMaxAgeOfOldestMessage,
      alertMaxApproximateNumberOfMessagesVisible: 15_000,
      maxReceiveCount: 1,
      visibilityTimeout: Duration.seconds(convertBatchResponseLambdaTimeout.toSeconds() * 2 + 1),
      createRetryLambda: false,
    },
    eventSource: {
      batchSize: 1,
      reportBatchItemFailures: true,
      maxConcurrency: convertBatchResponseMaxConcurrency,
    },
    waitTime: Duration.seconds(0),
  },
  convertPatientResponse: {
    name: "SurescriptsConvertPatientResponse",
    entry: "surescripts/convert-patient-response",
    lambda: {
      memory: 1024,
      timeout: convertPatientResponseLambdaTimeout,
    },
    queue: {
      alertMaxApproximateAgeOfOldestMessage: convertPatientResponseAlertMaxAgeOfOldestMessage,
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

function surescriptsEnvironmentVariablesAndSecrets({
  nestedStack,
  surescripts,
  surescriptsReplicaBucket,
  pharmacyConversionBucket,
  featureFlagsTableName,
}: {
  nestedStack: SurescriptsNestedStack;
  surescripts: EnvConfig["surescripts"];
  surescriptsReplicaBucket: s3.Bucket;
  pharmacyConversionBucket: s3.Bucket;
  featureFlagsTableName: string;
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
    FEATURE_FLAGS_TABLE_NAME: featureFlagsTableName,
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

interface SurescriptsNestedStackProps extends NestedStackProps {
  config: EnvConfig;
  vpc: ec2.IVpc;
  alertAction?: SnsAction;
  lambdaLayers: LambdaLayers;
  featureFlagsTable: dynamodb.Table;
}

export class SurescriptsNestedStack extends NestedStack {
  private readonly sftpActionLambda: Lambda;
  private readonly uploadRosterLambda: Lambda;
  private readonly ingestAllResponsesLambda: Lambda;
  private readonly convertBatchResponseLambda: Lambda;
  private readonly convertBatchResponseQueue: Queue;
  private readonly convertPatientResponseLambda: Lambda;
  private readonly convertPatientResponseQueue: Queue;
  private readonly surescriptsReplicaBucket: s3.Bucket;
  private readonly pharmacyConversionBucket: s3.Bucket;

  constructor(scope: Construct, id: string, props: SurescriptsNestedStackProps) {
    super(scope, id, props);

    this.terminationProtection = true;

    this.surescriptsReplicaBucket = createBucket(
      this,
      {
        bucketName: props.config.surescriptsReplicaBucketName,
        versioned: true,
      },
      "SurescriptsReplicaBucket"
    );

    this.pharmacyConversionBucket = createBucket(
      this,
      {
        bucketName: props.config.pharmacyConversionBucketName,
        versioned: true,
      },
      "PharmacyBundleBucket"
    );

    const { envVars, secrets } = surescriptsEnvironmentVariablesAndSecrets({
      nestedStack: this,
      surescripts: props.config.surescripts,
      surescriptsReplicaBucket: this.surescriptsReplicaBucket,
      pharmacyConversionBucket: this.pharmacyConversionBucket,
      featureFlagsTableName: props.featureFlagsTable.tableName,
    });

    const commonConfig = {
      lambdaLayers: props.lambdaLayers,
      vpc: props.vpc,
      envType: props.config.environmentType,
      sentryDsn: props.config.lambdasSentryDSN,
      alertAction: props.alertAction,
      surescripts: props.config.surescripts,
      systemRootOID: props.config.systemRootOID,
      termServerUrl: props.config.termServerUrl,
      envVars,
      secrets,
    };

    this.sftpActionLambda = this.setupLambda("sftpAction", {
      ...commonConfig,
      surescriptsReplicaBucket: this.surescriptsReplicaBucket,
      pharmacyConversionBucket: this.pharmacyConversionBucket,
      featureFlagsTable: props.featureFlagsTable,
    });

    this.uploadRosterLambda = this.setupLambda("rosterUpload", {
      ...commonConfig,
      surescriptsReplicaBucket: this.surescriptsReplicaBucket,
      pharmacyConversionBucket: this.pharmacyConversionBucket,
      featureFlagsTable: props.featureFlagsTable,
    });

    const { lambda: convertPatientResponseLambda, queue: convertPatientResponseQueue } =
      this.setupLambdaAndQueue(settings.convertPatientResponse, {
        ...commonConfig,
        surescriptsReplicaBucket: this.surescriptsReplicaBucket,
        pharmacyConversionBucket: this.pharmacyConversionBucket,
        featureFlagsTable: props.featureFlagsTable,
      });
    this.convertPatientResponseLambda = convertPatientResponseLambda;
    this.convertPatientResponseQueue = convertPatientResponseQueue;

    const { lambda: convertBatchResponseLambda, queue: convertBatchResponseQueue } =
      this.setupLambdaAndQueue(settings.convertBatchResponse, {
        ...commonConfig,
        surescriptsReplicaBucket: this.surescriptsReplicaBucket,
        pharmacyConversionBucket: this.pharmacyConversionBucket,
        featureFlagsTable: props.featureFlagsTable,
        downstreamQueue: {
          envVarName: "SURESCRIPTS_CONVERT_PATIENT_RESPONSE_QUEUE_URL",
          queue: this.convertPatientResponseQueue,
        },
      });
    this.convertBatchResponseLambda = convertBatchResponseLambda;
    this.convertBatchResponseQueue = convertBatchResponseQueue;

    this.ingestAllResponsesLambda = this.setupLambda("ingestAllResponses", {
      ...commonConfig,
      surescriptsReplicaBucket: this.surescriptsReplicaBucket,
      pharmacyConversionBucket: this.pharmacyConversionBucket,
      downstreamQueue: {
        envVarName: "SURESCRIPTS_CONVERT_BATCH_RESPONSE_QUEUE_URL",
        queue: this.convertBatchResponseQueue,
      },
      featureFlagsTable: props.featureFlagsTable,
    });

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
      this.uploadRosterLambda,
      this.ingestAllResponsesLambda,
      this.convertBatchResponseLambda,
      this.convertPatientResponseLambda,
    ];
  }

  getAssets(): SurescriptsAssets {
    return {
      surescriptsLambdas: [
        {
          envVarName: "SURESCRIPTS_SFTP_ACTION_LAMBDA_NAME",
          lambda: this.sftpActionLambda,
        },
        {
          envVarName: "SURESCRIPTS_UPLOAD_ROSTER_LAMBDA_NAME",
          lambda: this.uploadRosterLambda,
        },
        {
          envVarName: "SURESCRIPTS_INGEST_ALL_RESPONSES_LAMBDA_NAME",
          lambda: this.ingestAllResponsesLambda,
        },
        {
          envVarName: "SURESCRIPTS_CONVERT_BATCH_RESPONSE_LAMBDA_NAME",
          lambda: this.convertBatchResponseLambda,
        },
      ],
      surescriptsQueues: [
        {
          envVarName: "SURESCRIPTS_CONVERT_BATCH_RESPONSE_QUEUE_URL",
          queue: this.convertBatchResponseQueue,
        },
        {
          envVarName: "SURESCRIPTS_CONVERT_PATIENT_RESPONSE_QUEUE_URL",
          queue: this.convertPatientResponseQueue,
        },
      ],
      sftpActionLambda: this.sftpActionLambda,
      rosterUploadLambda: this.uploadRosterLambda,
      ingestAllResponsesLambda: this.ingestAllResponsesLambda,
      convertBatchResponseLambda: this.convertBatchResponseLambda,
      convertBatchResponseQueue: this.convertBatchResponseQueue,
      convertPatientResponseLambda: this.convertPatientResponseLambda,
      convertPatientResponseQueue: this.convertPatientResponseQueue,
      surescriptsReplicaBucket: this.surescriptsReplicaBucket,
      pharmacyConversionBucket: this.pharmacyConversionBucket,
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
      surescriptsReplicaBucket: s3.Bucket;
      pharmacyConversionBucket?: s3.Bucket;
      termServerUrl?: string;
      secrets: secret.ISecret[];
      downstreamQueue?: {
        envVarName: string;
        queue: Queue;
      };
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
      surescriptsReplicaBucket,
      pharmacyConversionBucket,
      termServerUrl,
      secrets,
      downstreamQueue,
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
        ...(job === "sftpAction" ? { SFTP_ACTION_LAMBDA: "surescripts" } : {}),
        ...(termServerUrl ? { TERM_SERVER_URL: termServerUrl } : {}),
        ...(downstreamQueue
          ? { [downstreamQueue.envVarName]: downstreamQueue.queue.queueUrl }
          : {}),
        SYSTEM_ROOT_OID: systemRootOID,
      },
      layers: [lambdaLayers.shared],
      vpc,
      alertSnsAction: alertAction,
    });

    surescriptsReplicaBucket.grantReadWrite(lambda);
    pharmacyConversionBucket?.grantReadWrite(lambda);
    featureFlagsTable.grantReadData(lambda);

    for (const secret of secrets) {
      secret.grantRead(lambda);
    }

    if (downstreamQueue) {
      downstreamQueue.queue.grantSendMessages(lambda);
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
      surescriptsReplicaBucket: s3.Bucket;
      pharmacyConversionBucket?: s3.Bucket;
      termServerUrl?: string;
      secrets: secret.ISecret[];
      featureFlagsTable: dynamodb.Table;
      downstreamQueue?: {
        envVarName: string;
        queue: Queue;
      };
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
      surescriptsReplicaBucket,
      pharmacyConversionBucket,
      termServerUrl,
      secrets,
      featureFlagsTable,
      downstreamQueue,
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
        ...(downstreamQueue
          ? { [downstreamQueue.envVarName]: downstreamQueue.queue.queueUrl }
          : {}),
      },
      layers: [lambdaLayers.shared],
      vpc,
      alertSnsAction: alertAction,
    });

    for (const secret of secrets) {
      secret.grantRead(lambda);
    }

    if (downstreamQueue) {
      downstreamQueue.queue.grantSendMessages(lambda);
    }

    surescriptsReplicaBucket.grantReadWrite(lambda);
    pharmacyConversionBucket?.grantReadWrite(lambda);
    featureFlagsTable.grantReadData(lambda);

    lambda.addEventSource(new SqsEventSource(queue, eventSourceSettings));

    return { lambda, queue };
  }
}
