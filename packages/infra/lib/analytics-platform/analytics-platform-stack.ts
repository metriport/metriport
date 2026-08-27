import { DatabaseCredsForLambda } from "@metriport/core/command/analytics-platform/utils";
import * as cdk from "aws-cdk-lib";
import { Aspects, Duration, NestedStack, NestedStackProps, RemovalPolicy } from "aws-cdk-lib";
import * as batch from "aws-cdk-lib/aws-batch";
import { SnsAction } from "aws-cdk-lib/aws-cloudwatch-actions";
import * as dynamodb from "aws-cdk-lib/aws-dynamodb";
import * as ec2 from "aws-cdk-lib/aws-ec2";
import { DockerImageAsset, Platform } from "aws-cdk-lib/aws-ecr-assets";
import * as ecs from "aws-cdk-lib/aws-ecs";
import * as events from "aws-cdk-lib/aws-events";
import * as targets from "aws-cdk-lib/aws-events-targets";
import * as iam from "aws-cdk-lib/aws-iam";
import * as lambda from "aws-cdk-lib/aws-lambda";
import { SqsEventSource } from "aws-cdk-lib/aws-lambda-event-sources";
import * as r53 from "aws-cdk-lib/aws-route53";
import * as rds from "aws-cdk-lib/aws-rds";
import * as s3 from "aws-cdk-lib/aws-s3";
import * as secret from "aws-cdk-lib/aws-secretsmanager";
import * as sns from "aws-cdk-lib/aws-sns";
import * as snsSubscriptions from "aws-cdk-lib/aws-sns-subscriptions";
import { Queue } from "aws-cdk-lib/aws-sqs";
import { Construct } from "constructs";
import path from "path";
import { AnalyticsPlatformConfig } from "../../config/analytics-platform-config";
import { EnvConfigNonSandbox } from "../../config/env-config";
import { EnvType } from "../env-type";
import { addErrorAlarmToLambdaFunc, createLambda } from "../shared/lambda";
import { LambdaLayers } from "../shared/lambda-layers";
import { addDBClusterAlertsAndAlarms } from "../shared/rds";
import { buildSecret } from "../shared/secrets";
import { LambdaSettingsWithNameAndEntry, QueueAndLambdaSettings } from "../shared/settings";
import { createQueue } from "../shared/sqs";
import { AnalyticsPlatformsAssets } from "./types";

/** Repo root so Docker build context works in both local and CI regardless of cwd. */
const repoRoot = path.resolve(__dirname, "..", "..", "..", "..", "..");

type DockerImageLambdaSettings = Omit<LambdaSettingsWithNameAndEntry, "entry">;
type BatchJobSettings = {
  memory: cdk.Size;
  cpu: number;
};

interface AnalyticsPlatformsSettings {
  fhirToCsvBulk: QueueAndLambdaSettings;
  fhirToCsvIncremental: QueueAndLambdaSettings;
  fhirToCsvTransform: DockerImageLambdaSettings;
  mergeCsvs: QueueAndLambdaSettings;
  rawToCoreTrigger: QueueAndLambdaSettings;
  rawToCore: BatchJobSettings;
  rawToCoreCompletionHandler: LambdaSettingsWithNameAndEntry;
  coreToHedisTrigger: QueueAndLambdaSettings;
  coreToHedis: BatchJobSettings;
  coreToHedisCompletionHandler: LambdaSettingsWithNameAndEntry;
  exportCoreFromFwhToS3Trigger: QueueAndLambdaSettings;
  exportCoreFromFwhToS3Batch: BatchJobSettings;
  snowflakeConnectorTrigger: QueueAndLambdaSettings;
  snowflakeConnectorBatch: BatchJobSettings;
  analyticsWebhookConsumer: QueueAndLambdaSettings;
  cqlTransform: QueueAndLambdaSettings;
  hedisCli: DockerImageLambdaSettings;
  createFhirTables: LambdaSettingsWithNameAndEntry;
}

function settings(): AnalyticsPlatformsSettings {
  const fhirToCsvTransformLambdaTimeout = Duration.minutes(10);
  const fhirToCsvBulkLambdaTimeout = fhirToCsvTransformLambdaTimeout.plus(Duration.seconds(30));
  const fhirToCsvIncrementalLambdaTimeout = fhirToCsvTransformLambdaTimeout.plus(
    Duration.seconds(30)
  );
  const mergeCsvsLambdaTimeout = Duration.minutes(15).minus(Duration.seconds(10));
  const rawToCoreTriggerLambdaTimeout = Duration.minutes(11);
  const rawToCoreCompletionHandlerLambdaTimeout = Duration.seconds(30);
  const coreToHedisTriggerLambdaTimeout = Duration.seconds(30);
  const coreToHedisCompletionHandlerLambdaTimeout = Duration.seconds(30);
  const exportCoreFromFwhToS3TriggerLambdaTimeout = Duration.seconds(30);
  const snowflakeConnectorTriggerLambdaTimeout = Duration.seconds(30);

  const fhirToCsvBulk: QueueAndLambdaSettings = {
    name: "FhirToCsvBulk",
    entry: "analytics-platform/fhir-to-csv-bulk",
    lambda: {
      memory: 512,
      timeout: fhirToCsvBulkLambdaTimeout,
      runtime: lambda.Runtime.NODEJS_20_X,
    },
    queue: {
      alertMaxApproximateAgeOfOldestMessage: Duration.hours(6),
      alertMaxApproximateNumberOfMessagesVisible: 5_000,
      maxReceiveCount: 1,
      visibilityTimeout: Duration.seconds(fhirToCsvBulkLambdaTimeout.toSeconds() * 2 + 1),
      createRetryLambda: false,
    },
    eventSource: {
      batchSize: 1,
      reportBatchItemFailures: true,
      maxConcurrency: 200,
    },
    waitTime: Duration.seconds(0),
  };
  const fhirToCsvIncremental: QueueAndLambdaSettings = {
    name: "FhirToCsvIncremental",
    entry: "analytics-platform/fhir-to-csv-incremental",
    lambda: {
      memory: 512,
      timeout: fhirToCsvIncrementalLambdaTimeout,
      runtime: lambda.Runtime.NODEJS_20_X,
    },
    queue: {
      alertMaxApproximateAgeOfOldestMessage: Duration.hours(6),
      alertMaxApproximateNumberOfMessagesVisible: 5_000,
      maxReceiveCount: 1,
      visibilityTimeout: Duration.seconds(fhirToCsvIncrementalLambdaTimeout.toSeconds()).plus(
        Duration.seconds(1)
      ),
      createRetryLambda: false,
      deliveryDelay: Duration.minutes(5).plus(Duration.seconds(10)),
    },
    eventSource: {
      batchSize: 1,
      reportBatchItemFailures: true,
      maxConcurrency: 100,
    },
    waitTime: Duration.seconds(0),
  };
  const fhirToCsvTransform: DockerImageLambdaSettings = {
    name: "FhirToCsvTransform",
    lambda: {
      memory: 2048,
      timeout: fhirToCsvTransformLambdaTimeout,
      ephemeralStorageSize: cdk.Size.gibibytes(2),
    },
  };
  const mergeCsvs: QueueAndLambdaSettings = {
    name: "MergeCsvs",
    entry: "analytics-platform/merge-csvs",
    lambda: {
      memory: 4096,
      timeout: mergeCsvsLambdaTimeout,
      runtime: lambda.Runtime.NODEJS_20_X,
    },
    queue: {
      alertMaxApproximateAgeOfOldestMessage: Duration.hours(2),
      alertMaxApproximateNumberOfMessagesVisible: 1_000,
      maxReceiveCount: 1,
      visibilityTimeout: Duration.seconds(mergeCsvsLambdaTimeout.toSeconds() * 2 + 1),
      createRetryLambda: false,
    },
    eventSource: {
      batchSize: 1,
      reportBatchItemFailures: true,
      maxConcurrency: 20,
    },
    waitTime: Duration.seconds(0),
  };
  const createFhirTablesLambdaTimeout = Duration.minutes(15);
  const createFhirTables: LambdaSettingsWithNameAndEntry = {
    name: "CreateFhirTables",
    entry: "analytics-platform/create-fhir-tables",
    lambda: {
      memory: 512,
      timeout: createFhirTablesLambdaTimeout,
      runtime: lambda.Runtime.NODEJS_20_X,
    },
  };
  const rawToCoreTrigger: QueueAndLambdaSettings = {
    name: "RawToCoreTrigger",
    entry: "analytics-platform/raw-to-core-trigger",
    lambda: {
      memory: 512,
      timeout: rawToCoreTriggerLambdaTimeout,
      runtime: lambda.Runtime.NODEJS_20_X,
    },
    queue: {
      alertMaxApproximateAgeOfOldestMessage: Duration.hours(2),
      alertMaxApproximateNumberOfMessagesVisible: 100,
      maxReceiveCount: 1,
      visibilityTimeout: Duration.seconds(rawToCoreTriggerLambdaTimeout.toSeconds() * 2 + 1),
      createRetryLambda: false,
    },
    eventSource: {
      batchSize: 1,
      reportBatchItemFailures: true,
      maxConcurrency: 10,
    },
    waitTime: Duration.seconds(0),
  };
  const rawToCore: BatchJobSettings = {
    memory: cdk.Size.mebibytes(8192),
    cpu: 4,
  };
  const rawToCoreCompletionHandler: LambdaSettingsWithNameAndEntry = {
    name: "RawToCoreCompletionHandler",
    entry: "analytics-platform/raw-to-core-completion-handler",
    lambda: {
      memory: 512,
      timeout: rawToCoreCompletionHandlerLambdaTimeout,
      runtime: lambda.Runtime.NODEJS_20_X,
    },
  };
  const coreToHedisTrigger: QueueAndLambdaSettings = {
    name: "CoreToHedisTrigger",
    entry: "analytics-platform/core-to-hedis-trigger",
    lambda: {
      memory: 512,
      timeout: coreToHedisTriggerLambdaTimeout,
      runtime: lambda.Runtime.NODEJS_20_X,
    },
    queue: {
      alertMaxApproximateAgeOfOldestMessage: Duration.hours(2),
      alertMaxApproximateNumberOfMessagesVisible: 100,
      maxReceiveCount: 1,
      visibilityTimeout: Duration.seconds(coreToHedisTriggerLambdaTimeout.toSeconds() * 2 + 1),
      createRetryLambda: false,
    },
    eventSource: {
      batchSize: 1,
      reportBatchItemFailures: true,
      maxConcurrency: 10,
    },
    waitTime: Duration.seconds(0),
  };
  const coreToHedis: BatchJobSettings = {
    memory: cdk.Size.mebibytes(8192),
    cpu: 4,
  };
  const coreToHedisCompletionHandler: LambdaSettingsWithNameAndEntry = {
    name: "CoreToHedisCompletionHandler",
    entry: "analytics-platform/core-to-hedis-completion-handler",
    lambda: {
      memory: 512,
      timeout: coreToHedisCompletionHandlerLambdaTimeout,
      runtime: lambda.Runtime.NODEJS_20_X,
    },
  };
  const exportCoreFromFwhToS3Trigger: QueueAndLambdaSettings = {
    name: "ExportCoreFromFwhToS3Trigger",
    entry: "analytics-platform/export-core-from-fwh-to-s3-trigger",
    lambda: {
      memory: 512,
      timeout: exportCoreFromFwhToS3TriggerLambdaTimeout,
      runtime: lambda.Runtime.NODEJS_20_X,
    },
    queue: {
      alertMaxApproximateAgeOfOldestMessage: Duration.hours(2),
      alertMaxApproximateNumberOfMessagesVisible: 100,
      maxReceiveCount: 1,
      visibilityTimeout: Duration.seconds(
        exportCoreFromFwhToS3TriggerLambdaTimeout.toSeconds() * 2 + 1
      ),
      createRetryLambda: false,
    },
    eventSource: {
      batchSize: 1,
      reportBatchItemFailures: true,
      maxConcurrency: 10,
    },
    waitTime: Duration.seconds(0),
  };
  const exportCoreFromFwhToS3Batch: BatchJobSettings = {
    memory: cdk.Size.mebibytes(10240),
    cpu: 4,
  };
  const snowflakeConnectorTrigger: QueueAndLambdaSettings = {
    name: "SnowflakeConnectorTrigger",
    entry: "analytics-platform/external/snowflake-connector-trigger",
    lambda: {
      memory: 512,
      timeout: snowflakeConnectorTriggerLambdaTimeout,
      runtime: lambda.Runtime.NODEJS_20_X,
    },
    queue: {
      alertMaxApproximateAgeOfOldestMessage: Duration.hours(2),
      alertMaxApproximateNumberOfMessagesVisible: 100,
      maxReceiveCount: 1,
      visibilityTimeout: Duration.seconds(
        snowflakeConnectorTriggerLambdaTimeout.toSeconds() * 2 + 1
      ),
      createRetryLambda: false,
    },
    eventSource: {
      batchSize: 1,
      reportBatchItemFailures: true,
      maxConcurrency: 5,
    },
    waitTime: Duration.seconds(0),
  };
  const snowflakeConnectorBatch: BatchJobSettings = {
    memory: cdk.Size.mebibytes(10240),
    cpu: 4,
  };
  const analyticsWebhookConsumerLambdaTimeout = Duration.minutes(1);
  const analyticsWebhookConsumer: QueueAndLambdaSettings = {
    name: "AnalyticsWebhookConsumer",
    entry: "analytics-platform/analytics-webhook-consumer",
    lambda: {
      memory: 512,
      timeout: analyticsWebhookConsumerLambdaTimeout,
      runtime: lambda.Runtime.NODEJS_20_X,
    },
    queue: {
      alertMaxApproximateAgeOfOldestMessage: Duration.hours(1),
      alertMaxApproximateNumberOfMessagesVisible: 100,
      maxReceiveCount: 1,
      visibilityTimeout: Duration.seconds(
        analyticsWebhookConsumerLambdaTimeout.toSeconds() * 2 + 1
      ),
      createRetryLambda: false,
    },
    eventSource: {
      batchSize: 1,
      reportBatchItemFailures: true,
      maxConcurrency: 10,
    },
    waitTime: Duration.seconds(0),
  };
  const cqlTransformLambdaTimeout = Duration.minutes(10).plus(Duration.seconds(10));
  const cqlTransform: QueueAndLambdaSettings = {
    name: "CqlTransform",
    entry: "analytics-platform/care-gaps/cql-transform",
    lambda: {
      memory: 512,
      timeout: cqlTransformLambdaTimeout,
    },
    queue: {
      alertMaxApproximateAgeOfOldestMessage: Duration.hours(6),
      alertMaxApproximateNumberOfMessagesVisible: 5_000,
      maxReceiveCount: 3,
      visibilityTimeout: Duration.seconds(cqlTransformLambdaTimeout.toSeconds() * 2 + 1),
      createRetryLambda: false,
    },
    eventSource: {
      batchSize: 1,
      reportBatchItemFailures: true,
      maxConcurrency: 100,
    },
    waitTime: Duration.seconds(0),
  };
  const hedisCliLambdaTimeout = Duration.minutes(15);
  const hedisCli: DockerImageLambdaSettings = {
    name: "HedisCli",
    lambda: {
      memory: 4096,
      timeout: hedisCliLambdaTimeout,
      ephemeralStorageSize: cdk.Size.gibibytes(2),
    },
  };
  return {
    fhirToCsvBulk,
    fhirToCsvIncremental,
    fhirToCsvTransform,
    mergeCsvs,
    createFhirTables,
    rawToCoreTrigger,
    rawToCore,
    rawToCoreCompletionHandler,
    coreToHedisTrigger,
    coreToHedis,
    coreToHedisCompletionHandler,
    exportCoreFromFwhToS3Trigger,
    exportCoreFromFwhToS3Batch,
    snowflakeConnectorTrigger,
    snowflakeConnectorBatch,
    analyticsWebhookConsumer,
    cqlTransform,
    hedisCli,
  };
}

interface AnalyticsPlatformsNestedStackProps extends NestedStackProps {
  config: EnvConfigNonSandbox;
  vpc: ec2.IVpc;
  alertAction?: SnsAction;
  alarmAction: SnsAction;
  lambdaLayers: LambdaLayers;
  medicalDocumentsBucket: s3.Bucket;
  featureFlagsTable: dynamodb.Table;
}

export class AnalyticsPlatformsNestedStack extends NestedStack {
  readonly dbSecurityGroupId: string;
  readonly analyticsDbReaderHost: string;
  readonly analyticsPlatformBucket: s3.Bucket;
  readonly dbCredsSecret: secret.Secret;
  readonly fhirToCsvDbPassword: secret.ISecret;
  readonly rawToCoreDbPassword: secret.ISecret;
  readonly fhirToCsvBulkLambda: lambda.Function;
  readonly fhirToCsvBulkQueue: Queue;
  readonly fhirToCsvIncrementalLambda: lambda.Function;
  readonly fhirToCsvIncrementalQueue: Queue;
  readonly mergeCsvsLambda: lambda.Function;
  readonly mergeCsvsQueue: Queue;
  readonly createFhirTablesLambda: lambda.Function;
  // Raw to Core
  readonly rawToCoreCompletionTopic: sns.Topic;
  readonly rawToCoreCompletionHandlerLambda: lambda.Function;
  readonly rawToCoreTriggerLambda: lambda.Function;
  readonly rawToCoreTriggerQueue: Queue;
  readonly rawToCoreBatchJob: batch.EcsJobDefinition;
  readonly rawToCoreBatchJobContainer: batch.EcsFargateContainerDefinition;
  readonly rawToCoreBatchJobQueue: batch.JobQueue;
  // Core to HEDIS
  readonly coreToHedisCompletionTopic: sns.Topic;
  readonly coreToHedisCompletionHandlerLambda: lambda.Function;
  readonly coreToHedisTriggerLambda: lambda.Function;
  readonly coreToHedisTriggerQueue: Queue;
  readonly coreToHedisBatchJob: batch.EcsJobDefinition;
  readonly coreToHedisBatchJobContainer: batch.EcsFargateContainerDefinition;
  readonly coreToHedisBatchJobQueue: batch.JobQueue;
  // Export Core From FWH to S3
  readonly exportCoreFromFwhToS3CompletionTopic: sns.Topic;
  readonly exportCoreFromFwhToS3TriggerLambda: lambda.Function;
  readonly exportCoreFromFwhToS3TriggerQueue: Queue;
  readonly exportCoreFromFwhToS3BatchJob: batch.EcsJobDefinition;
  readonly exportCoreFromFwhToS3BatchJobContainer: batch.EcsFargateContainerDefinition;
  readonly exportCoreFromFwhToS3BatchJobQueue: batch.JobQueue;
  // Connectors
  readonly connectorIngestionCompleteTopic: sns.Topic;
  readonly snowflakeConnectorTriggerLambda: lambda.Function;
  readonly snowflakeConnectorTriggerQueue: Queue;
  readonly snowflakeConnectorBatchJob: batch.EcsJobDefinition;
  readonly snowflakeConnectorBatchJobContainer: batch.EcsFargateContainerDefinition;
  readonly snowflakeConnectorBatchJobQueue: batch.JobQueue;
  readonly analyticsWebhookConsumerLambda: lambda.Function;
  readonly analyticsWebhookConsumerQueue: Queue;
  readonly cqlTransformLambda: lambda.Function;
  readonly cqlTransformQueue: Queue;
  readonly hedisCliLambda: lambda.DockerImageFunction;
  readonly config: AnalyticsPlatformConfig;

  constructor(scope: Construct, id: string, props: AnalyticsPlatformsNestedStackProps) {
    super(scope, id, props);

    this.terminationProtection = true;
    this.config = props.config.analyticsPlatform;

    // TODO ENG-858 reintroduce this
    // const snowflakeCreds = buildSecret(
    //   this,
    //   props.config.analyticsPlatform.secrets.SNOWFLAKE_CREDS
    // );

    this.analyticsPlatformBucket = this.setupAnalyticsPlatformBucket({
      config: props.config,
    });

    const { dbCluster, dbCredsSecret } = this.setupDB({
      config: props.config,
      envType: props.config.environmentType,
      awsRegion: props.config.region,
      vpc: props.vpc,
      analyticsBucket: this.analyticsPlatformBucket,
      alertAction: props.alertAction,
      alarmAction: props.alarmAction,
    });
    this.dbCredsSecret = dbCredsSecret;
    this.analyticsDbReaderHost = dbCluster.clusterReadEndpoint.hostname;
    // Export security group ID as string to avoid cross-stack circular dependencies
    const dbSecurityGroup = dbCluster.connections.securityGroups[0];
    if (!dbSecurityGroup) {
      throw new Error("Analytics DB cluster security group not found");
    }
    this.dbSecurityGroupId = dbSecurityGroup.securityGroupId;
    // Allow writer → reader within cluster (e.g. postgres_fdw from writer to reader endpoint)
    dbCluster.connections.allowDefaultPortFrom(
      ec2.Peer.securityGroupId(this.dbSecurityGroupId),
      "Allow writer to reader within cluster (FDW)"
    );

    const analyticsPlatformZoneName = "analytics-platform";
    const analyticsPlatformZone = new r53.PrivateHostedZone(this, "AnalyticsPlatformZone", {
      zoneName: analyticsPlatformZoneName,
      vpc: props.vpc,
    });
    const readerCnameHost = `reader.${analyticsPlatformZoneName}`;
    new r53.CnameRecord(this, "AnalyticsDbReaderCname", {
      zone: analyticsPlatformZone,
      recordName: "reader",
      domainName: dbCluster.clusterReadEndpoint.hostname,
      ttl: Duration.minutes(1),
    });

    const fhirToCsvDbPassword = buildSecret(this, this.config.secretNames.FHIR_TO_CSV_DB_PASSWORD);
    const rawToCoreDbPassword = buildSecret(this, this.config.secretNames.RAW_TO_CORE_DB_PASSWORD);
    this.fhirToCsvDbPassword = fhirToCsvDbPassword;
    this.rawToCoreDbPassword = rawToCoreDbPassword;

    const analyticsPlatformComputeEnvironment = new batch.FargateComputeEnvironment(
      this,
      "AnalyticsPlatformComputeEnvironment",
      {
        vpc: props.vpc,
      }
    );

    dbCluster.connections.allowDefaultPortFrom(analyticsPlatformComputeEnvironment);

    const { fhirToCsvTransformLambda } = this.setupFhirToCsvTransformLambda({
      config: props.config,
      envType: props.config.environmentType,
      awsRegion: props.config.region,
      lambdaLayers: props.lambdaLayers,
      vpc: props.vpc,
      sentryDsn: props.config.sentryDSN,
      alertAction: props.alertAction,
      analyticsPlatformBucket: this.analyticsPlatformBucket,
      medicalDocumentsBucket: props.medicalDocumentsBucket,
    });
    const { lambda: fhirToCsvBulkLambda, queue: fhirToCsvBulkQueue } =
      this.setupFhirToCsvBulkLambda({
        config: props.config,
        envType: props.config.environmentType,
        awsRegion: props.config.region,
        lambdaLayers: props.lambdaLayers,
        vpc: props.vpc,
        sentryDsn: props.config.sentryDSN,
        alertAction: props.alertAction,
        fhirToCsvTransformLambda,
        featureFlagsTable: props.featureFlagsTable,
        medicalDocumentsBucket: props.medicalDocumentsBucket,
      });
    this.fhirToCsvBulkLambda = fhirToCsvBulkLambda;
    this.fhirToCsvBulkQueue = fhirToCsvBulkQueue;

    const { lambda: fhirToCsvIncrementalLambda, queue: fhirToCsvIncrementalQueue } =
      this.setupFhirToCsvIncrementalLambda({
        config: props.config,
        envType: props.config.environmentType,
        awsRegion: props.config.region,
        lambdaLayers: props.lambdaLayers,
        vpc: props.vpc,
        sentryDsn: props.config.sentryDSN,
        alertAction: props.alertAction,
        analyticsPlatformBucket: this.analyticsPlatformBucket,
        fhirToCsvTransformLambda,
        featureFlagsTable: props.featureFlagsTable,
        medicalDocumentsBucket: props.medicalDocumentsBucket,
        dbCluster,
        fhirToCsvDbPassword,
      });
    this.fhirToCsvIncrementalLambda = fhirToCsvIncrementalLambda;
    this.fhirToCsvIncrementalQueue = fhirToCsvIncrementalQueue;

    const { mergeCsvsLambda, queue: mergeCsvsQueue } = this.setupMergeCsvsLambda({
      config: props.config,
      envType: props.config.environmentType,
      awsRegion: props.config.region,
      lambdaLayers: props.lambdaLayers,
      vpc: props.vpc,
      sentryDsn: props.config.sentryDSN,
      alertAction: props.alertAction,
      bucket: this.analyticsPlatformBucket,
    });
    this.mergeCsvsLambda = mergeCsvsLambda;
    this.mergeCsvsQueue = mergeCsvsQueue;

    const createFhirTablesLambda = this.setupCreateFhirTablesLambda({
      config: props.config,
      envType: props.config.environmentType,
      lambdaLayers: props.lambdaLayers,
      vpc: props.vpc,
      sentryDsn: props.config.sentryDSN,
      alertAction: props.alertAction,
      dbCluster,
      dbCredsSecret: this.dbCredsSecret,
      fhirToCsvDbUsername: this.config.rds.fhirToCsvDbUsername,
      fhirToCsvDbPassword: this.fhirToCsvDbPassword,
      rawToCoreDbUsername: this.config.rds.rawToCoreDbUsername,
      rawToCoreDbPassword: this.rawToCoreDbPassword,
      analyticsDbReaderCname: readerCnameHost,
    });
    this.createFhirTablesLambda = createFhirTablesLambda;

    this.rawToCoreCompletionTopic = new sns.Topic(this, "RawToCoreCompletionTopic", {
      topicName: `raw-to-core-completion-${props.config.environmentType}.fifo`,
      displayName: "Raw To Core Completion Notifications",
      fifo: true,
    });

    const {
      queue: rawToCoreBatchJobQueue,
      container: rawToCoreBatchJobContainer,
      job: rawToCoreBatchJob,
    } = this.setupRawToCoreBatchJob({
      config: props.config,
      envType: props.config.environmentType,
      awsRegion: props.config.region,
      vpc: props.vpc,
      dbCluster,
      rawToCoreDbPassword,
      computeEnvironment: analyticsPlatformComputeEnvironment,
    });
    this.rawToCoreBatchJob = rawToCoreBatchJob;
    this.rawToCoreBatchJobContainer = rawToCoreBatchJobContainer;
    this.rawToCoreBatchJobQueue = rawToCoreBatchJobQueue;

    const { lambda: rawToCoreCompletionHandlerLambda } = this.setupRawToCoreCompletionHandlerLambda(
      {
        envType: props.config.environmentType,
        lambdaLayers: props.lambdaLayers,
        vpc: props.vpc,
        sentryDsn: props.config.sentryDSN,
        alertAction: props.alertAction,
        rawToCoreBatchJob,
        rawToCoreCompletionTopic: this.rawToCoreCompletionTopic,
        featureFlagsTable: props.featureFlagsTable,
      }
    );
    this.rawToCoreCompletionHandlerLambda = rawToCoreCompletionHandlerLambda;

    const { lambda: rawToCoreTriggerLambda, queue: rawToCoreTriggerQueue } =
      this.setupRawToCoreTriggerLambda({
        config: props.config,
        envType: props.config.environmentType,
        lambdaLayers: props.lambdaLayers,
        vpc: props.vpc,
        sentryDsn: props.config.sentryDSN,
        alertAction: props.alertAction,
        rawToCoreBatchJob,
        rawToCoreBatchJobQueue,
        featureFlagsTable: props.featureFlagsTable,
      });
    this.rawToCoreTriggerLambda = rawToCoreTriggerLambda;
    this.rawToCoreTriggerQueue = rawToCoreTriggerQueue;

    this.coreToHedisCompletionTopic = new sns.Topic(this, "CoreToHedisCompletionTopic", {
      topicName: `core-to-hedis-completion-${props.config.environmentType}.fifo`,
      displayName: "Core To HEDIS Completion Notifications",
      fifo: true,
    });

    const {
      queue: coreToHedisBatchJobQueue,
      container: coreToHedisBatchJobContainer,
      job: coreToHedisBatchJob,
    } = this.setupCoreToHedisBatchJob({
      config: props.config,
      envType: props.config.environmentType,
      awsRegion: props.config.region,
      vpc: props.vpc,
      dbCluster,
      rawToCoreDbPassword,
      computeEnvironment: analyticsPlatformComputeEnvironment,
    });
    this.coreToHedisBatchJob = coreToHedisBatchJob;
    this.coreToHedisBatchJobContainer = coreToHedisBatchJobContainer;
    this.coreToHedisBatchJobQueue = coreToHedisBatchJobQueue;

    const { lambda: coreToHedisCompletionHandlerLambda } =
      this.setupCoreToHedisCompletionHandlerLambda({
        envType: props.config.environmentType,
        lambdaLayers: props.lambdaLayers,
        vpc: props.vpc,
        sentryDsn: props.config.sentryDSN,
        alertAction: props.alertAction,
        coreToHedisBatchJob,
        coreToHedisCompletionTopic: this.coreToHedisCompletionTopic,
        featureFlagsTable: props.featureFlagsTable,
      });
    this.coreToHedisCompletionHandlerLambda = coreToHedisCompletionHandlerLambda;

    const { lambda: coreToHedisTriggerLambda, queue: coreToHedisTriggerQueue } =
      this.setupCoreToHedisTriggerLambda({
        config: props.config,
        envType: props.config.environmentType,
        lambdaLayers: props.lambdaLayers,
        vpc: props.vpc,
        sentryDsn: props.config.sentryDSN,
        alertAction: props.alertAction,
        coreToHedisBatchJob,
        coreToHedisBatchJobQueue,
        featureFlagsTable: props.featureFlagsTable,
      });
    this.coreToHedisTriggerLambda = coreToHedisTriggerLambda;
    this.coreToHedisTriggerQueue = coreToHedisTriggerQueue;

    // TODO: Turn on this subscription once core-to-hedis is enabled
    /*
    this.rawToCoreCompletionTopic.addSubscription(
      new snsSubscriptions.SqsSubscription(coreToHedisTriggerQueue, {
        rawMessageDelivery: true,
      })
    );
    */

    this.exportCoreFromFwhToS3CompletionTopic = new sns.Topic(
      this,
      "ExportCoreFromFwhToS3CompletionTopic",
      {
        topicName: `export-core-from-fwh-to-s3-completion-${props.config.environmentType}.fifo`,
        displayName: "Export Core From FWH to S3 Completion Notifications",
        fifo: true,
      }
    );

    const {
      job: exportCoreFromFwhToS3BatchJob,
      container: exportCoreFromFwhToS3BatchJobContainer,
      queue: exportCoreFromFwhToS3BatchJobQueue,
    } = this.setupExportCoreFromFwhToS3BatchJob({
      config: props.config,
      envType: props.config.environmentType,
      awsRegion: props.config.region,
      vpc: props.vpc,
      analyticsPlatformBucket: this.analyticsPlatformBucket,
      dbCluster,
      rawToCoreDbPassword,
      computeEnvironment: analyticsPlatformComputeEnvironment,
      exportCoreFromFwhToS3CompletionTopic: this.exportCoreFromFwhToS3CompletionTopic,
    });
    this.exportCoreFromFwhToS3BatchJob = exportCoreFromFwhToS3BatchJob;
    this.exportCoreFromFwhToS3BatchJobContainer = exportCoreFromFwhToS3BatchJobContainer;
    this.exportCoreFromFwhToS3BatchJobQueue = exportCoreFromFwhToS3BatchJobQueue;

    const { lambda: exportCoreFromFwhToS3TriggerLambda, queue: exportCoreFromFwhToS3TriggerQueue } =
      this.setupExportCoreFromFwhToS3TriggerLambda({
        config: props.config,
        envType: props.config.environmentType,
        lambdaLayers: props.lambdaLayers,
        vpc: props.vpc,
        sentryDsn: props.config.sentryDSN,
        alertAction: props.alertAction,
        exportCoreFromFwhToS3BatchJob,
        exportCoreFromFwhToS3BatchJobQueue,
        featureFlagsTable: props.featureFlagsTable,
      });
    this.exportCoreFromFwhToS3TriggerLambda = exportCoreFromFwhToS3TriggerLambda;
    this.exportCoreFromFwhToS3TriggerQueue = exportCoreFromFwhToS3TriggerQueue;

    this.rawToCoreCompletionTopic.addSubscription(
      new snsSubscriptions.SqsSubscription(exportCoreFromFwhToS3TriggerQueue, {
        rawMessageDelivery: true,
      })
    );

    this.connectorIngestionCompleteTopic = new sns.Topic(this, "ConnectorIngestionCompleteTopic", {
      topicName: `connector-ingestion-complete-${props.config.environmentType}.fifo`,
      displayName: "Connector Ingestion Completion Notifications",
      fifo: true,
    });

    const {
      job: snowflakeConnectorBatchJob,
      container: snowflakeConnectorBatchJobContainer,
      queue: snowflakeConnectorBatchJobQueue,
    } = this.setupSnowflakeConnectorBatchJob({
      config: props.config,
      envType: props.config.environmentType,
      awsRegion: props.config.region,
      vpc: props.vpc,
      analyticsPlatformBucket: this.analyticsPlatformBucket,
      computeEnvironment: analyticsPlatformComputeEnvironment,
      snowflakeCredsForAllRegionsSecret: buildSecret(
        this,
        props.config.analyticsPlatform.secretNames.SNOWFLAKE_CREDS_FOR_ALL_REGIONS
      ),
      snowflakeSettingsForAllCxsSecret: buildSecret(
        this,
        props.config.analyticsPlatform.secretNames.SNOWFLAKE_SETTINGS_FOR_ALL_CXS
      ),
      connectorIngestionCompleteTopic: this.connectorIngestionCompleteTopic,
    });
    this.snowflakeConnectorBatchJob = snowflakeConnectorBatchJob;
    this.snowflakeConnectorBatchJobContainer = snowflakeConnectorBatchJobContainer;
    this.snowflakeConnectorBatchJobQueue = snowflakeConnectorBatchJobQueue;

    const { lambda: snowflakeConnectorTriggerLambda, queue: snowflakeConnectorTriggerQueue } =
      this.setupSnowflakeConnectorTriggerLambda({
        config: props.config,
        envType: props.config.environmentType,
        lambdaLayers: props.lambdaLayers,
        vpc: props.vpc,
        sentryDsn: props.config.sentryDSN,
        alertAction: props.alertAction,
        snowflakeConnectorBatchJob,
        snowflakeConnectorBatchJobQueue,
        featureFlagsTable: props.featureFlagsTable,
      });
    this.snowflakeConnectorTriggerLambda = snowflakeConnectorTriggerLambda;
    this.snowflakeConnectorTriggerQueue = snowflakeConnectorTriggerQueue;

    this.exportCoreFromFwhToS3CompletionTopic.addSubscription(
      new snsSubscriptions.SqsSubscription(snowflakeConnectorTriggerQueue, {
        rawMessageDelivery: true,
      })
    );

    const { lambda: analyticsWebhookConsumerLambda, queue: analyticsWebhookConsumerQueue } =
      this.setupAnalyticsWebhookConsumerLambda({
        config: props.config,
        envType: props.config.environmentType,
        lambdaLayers: props.lambdaLayers,
        vpc: props.vpc,
        sentryDsn: props.config.sentryDSN,
        alertAction: props.alertAction,
        featureFlagsTable: props.featureFlagsTable,
      });
    this.analyticsWebhookConsumerLambda = analyticsWebhookConsumerLambda;
    this.analyticsWebhookConsumerQueue = analyticsWebhookConsumerQueue;

    this.connectorIngestionCompleteTopic.addSubscription(
      new snsSubscriptions.SqsSubscription(analyticsWebhookConsumerQueue, {
        rawMessageDelivery: true,
      })
    );

    const { hedisCliLambda } = this.setupHedisCliLambda({
      config: props.config,
      envType: props.config.environmentType,
      awsRegion: props.config.region,
      vpc: props.vpc,
      alertAction: props.alertAction,
      analyticsPlatformBucket: this.analyticsPlatformBucket,
      medicalDocumentsBucket: props.medicalDocumentsBucket,
    });
    this.hedisCliLambda = hedisCliLambda;

    const { lambda: cqlTransformLambda, queue: cqlTransformQueue } = this.setupCqlTransformLambda({
      config: props.config,
      envType: props.config.environmentType,
      awsRegion: props.config.region,
      lambdaLayers: props.lambdaLayers,
      vpc: props.vpc,
      sentryDsn: props.config.sentryDSN,
      alertAction: props.alertAction,
      analyticsPlatformBucket: this.analyticsPlatformBucket,
      hedisCliLambda,
    });
    this.cqlTransformLambda = cqlTransformLambda;
    this.cqlTransformQueue = cqlTransformQueue;
  }

  getAssets(): AnalyticsPlatformsAssets {
    return {
      dbSecurityGroupId: this.dbSecurityGroupId,
      analyticsDbReaderHost: this.analyticsDbReaderHost,
      analyticsPlatformBucket: this.analyticsPlatformBucket,
      dbCredsSecret: this.dbCredsSecret,
      fhirToCsvBulkLambda: this.fhirToCsvBulkLambda,
      fhirToCsvBulkQueue: this.fhirToCsvBulkQueue,
      fhirToCsvIncrementalLambda: this.fhirToCsvIncrementalLambda,
      fhirToCsvIncrementalQueue: this.fhirToCsvIncrementalQueue,
      mergeCsvsLambda: this.mergeCsvsLambda,
      mergeCsvsQueue: this.mergeCsvsQueue,
      createFhirTablesLambda: this.createFhirTablesLambda,
      rawToCoreCompletionTopic: this.rawToCoreCompletionTopic,
      rawToCoreTriggerLambda: this.rawToCoreTriggerLambda,
      rawToCoreTriggerQueue: this.rawToCoreTriggerQueue,
      rawToCoreBatchJob: this.rawToCoreBatchJob,
      rawToCoreBatchJobQueue: this.rawToCoreBatchJobQueue,
      rawToCoreBatchJobContainer: this.rawToCoreBatchJobContainer,
      coreToHedisCompletionTopic: this.coreToHedisCompletionTopic,
      coreToHedisTriggerLambda: this.coreToHedisTriggerLambda,
      coreToHedisTriggerQueue: this.coreToHedisTriggerQueue,
      coreToHedisBatchJob: this.coreToHedisBatchJob,
      coreToHedisBatchJobQueue: this.coreToHedisBatchJobQueue,
      coreToHedisBatchJobContainer: this.coreToHedisBatchJobContainer,
      exportCoreFromFwhToS3CompletionTopic: this.exportCoreFromFwhToS3CompletionTopic,
      exportCoreFromFwhToS3TriggerLambda: this.exportCoreFromFwhToS3TriggerLambda,
      exportCoreFromFwhToS3TriggerQueue: this.exportCoreFromFwhToS3TriggerQueue,
      exportCoreFromFwhToS3BatchJob: this.exportCoreFromFwhToS3BatchJob,
      exportCoreFromFwhToS3BatchJobContainer: this.exportCoreFromFwhToS3BatchJobContainer,
      exportCoreFromFwhToS3BatchJobQueue: this.exportCoreFromFwhToS3BatchJobQueue,
      connectorIngestionCompleteTopic: this.connectorIngestionCompleteTopic,
      snowflakeConnectorTriggerLambda: this.snowflakeConnectorTriggerLambda,
      snowflakeConnectorTriggerQueue: this.snowflakeConnectorTriggerQueue,
      snowflakeConnectorBatchJob: this.snowflakeConnectorBatchJob,
      snowflakeConnectorBatchJobContainer: this.snowflakeConnectorBatchJobContainer,
      snowflakeConnectorBatchJobQueue: this.snowflakeConnectorBatchJobQueue,
      analyticsWebhookConsumerLambda: this.analyticsWebhookConsumerLambda,
      analyticsWebhookConsumerQueue: this.analyticsWebhookConsumerQueue,
      fhirToCsvUserName: this.config.rds.fhirToCsvDbUsername,
      rawToCoreUserName: this.config.rds.rawToCoreDbUsername,
      fhirToCsvDbPassword: this.fhirToCsvDbPassword,
      rawToCoreDbPassword: this.rawToCoreDbPassword,
      cqlTransformLambda: this.cqlTransformLambda,
      cqlTransformQueue: this.cqlTransformQueue,
      hedisCliLambda: this.hedisCliLambda,
    };
  }

  private setupAnalyticsPlatformBucket({ config }: { config: EnvConfigNonSandbox }): s3.Bucket {
    const analyticsPlatformBucket = new s3.Bucket(this, "AnalyticsPlatformBucket", {
      bucketName: config.analyticsPlatform.bucketName,
      publicReadAccess: false,
      encryption: s3.BucketEncryption.S3_MANAGED,
      versioned: true,
    });

    // Snowflake access via S3 Integration https://docs.snowflake.com/en/user-guide/data-load-s3-config-storage-integration
    const snowflakePrefix = "snowflake";
    const s3Policy = new iam.Policy(this, "SnowflakeAnalyticsPlatformS3Policy", {
      policyName: `SnowflakeAnalyticsPlatformS3Policy-${config.environmentType}`,
      statements: [
        new iam.PolicyStatement({
          effect: iam.Effect.ALLOW,
          actions: [
            "s3:PutObject",
            "s3:GetObject",
            "s3:GetObjectVersion",
            "s3:DeleteObject",
            "s3:DeleteObjectVersion",
          ],
          resources: [analyticsPlatformBucket.bucketArn + "/" + snowflakePrefix + "/*"],
        }),
        new iam.PolicyStatement({
          effect: iam.Effect.ALLOW,
          actions: ["s3:ListBucket", "s3:GetBucketLocation"],
          resources: [analyticsPlatformBucket.bucketArn],
          conditions: {
            StringLike: {
              "s3:prefix": [`${snowflakePrefix}/*`],
            },
          },
        }),
      ],
    });
    new iam.Role(this, "SnowflakeIntegrationRole", {
      roleName: `SnowflakeIntegrationRole-${config.environmentType}`,
      assumedBy: new iam.ArnPrincipal(config.analyticsPlatform.snowflake.integrationUserArn),
      externalIds: [config.analyticsPlatform.snowflake.integrationExternalId],
      inlinePolicies: {
        SnowflakeAnalyticsPlatformS3Policy: s3Policy.document,
      },
    });
    return analyticsPlatformBucket;
  }

  private setupDB(ownProps: {
    config: EnvConfigNonSandbox;
    envType: EnvType;
    awsRegion: string;
    vpc: ec2.IVpc;
    analyticsBucket: s3.Bucket;
    alertAction: SnsAction | undefined;
    alarmAction: SnsAction;
  }): {
    dbCluster: rds.DatabaseCluster;
    dbCredsSecret: secret.Secret;
  } {
    const dbConfig = ownProps.config.analyticsPlatform.rds;
    // create database credentials
    const dbSecretName = "AnalyticsDbCreds";
    const dbCredsSecret = new secret.Secret(this, dbSecretName, {
      secretName: dbSecretName,
      generateSecretString: {
        secretStringTemplate: JSON.stringify({
          username: dbConfig.username,
        }),
        excludePunctuation: true,
        includeSpace: false,
        generateStringKey: "password",
      },
    });
    const dbCreds = rds.Credentials.fromSecret(dbCredsSecret);
    const dbEngine = rds.DatabaseClusterEngine.auroraPostgres({
      version: rds.AuroraPostgresEngineVersion.VER_16_1,
    });
    const parameterGroup = new rds.ParameterGroup(this, "AnalyticsDbParams", {
      engine: dbEngine,
      parameters: {
        ...(dbConfig.minSlowLogDurationInMs
          ? {
              log_min_duration_statement: dbConfig.minSlowLogDurationInMs.toString(),
            }
          : undefined),
      },
    });

    const s3BucketLevelStatement = new iam.PolicyStatement({
      effect: iam.Effect.ALLOW,
      actions: ["s3:ListBucket", "s3:GetBucketLocation", "s3:ListBucketMultipartUploads"],
      resources: [`arn:aws:s3:::${ownProps.analyticsBucket.bucketName}`],
    });

    const s3ImportPolicy = new iam.PolicyDocument({
      statements: [
        new iam.PolicyStatement({
          effect: iam.Effect.ALLOW,
          actions: ["s3:GetObject", "s3:GetObjectVersion", "s3:ListMultipartUploadParts"],
          resources: [`arn:aws:s3:::${ownProps.analyticsBucket.bucketName}/*`],
        }),
        s3BucketLevelStatement,
      ],
    });

    const s3ExportPolicy = new iam.PolicyDocument({
      statements: [
        new iam.PolicyStatement({
          effect: iam.Effect.ALLOW,
          actions: [
            "s3:PutObject",
            "s3:GetObject",
            "s3:GetObjectVersion",
            "s3:DeleteObject",
            "s3:DeleteObjectVersion",
            "s3:AbortMultipartUpload",
            "s3:ListMultipartUploadParts",
          ],
          resources: [`arn:aws:s3:::${ownProps.analyticsBucket.bucketName}/*`],
        }),
        s3BucketLevelStatement,
      ],
    });

    const dbClusterS3ImportRole = new iam.Role(this, "DatabaseClusterS3ImportRole", {
      roleName: `DatabaseClusterS3ImportRole-${ownProps.envType}`,
      assumedBy: new iam.ServicePrincipal("rds.amazonaws.com"),
      inlinePolicies: {
        S3ImportPolicy: s3ImportPolicy,
      },
    });

    const dbClusterS3ExportRole = new iam.Role(this, "DatabaseClusterS3ExportRole", {
      roleName: `DatabaseClusterS3ExportRole-${ownProps.envType}`,
      assumedBy: new iam.ServicePrincipal("rds.amazonaws.com"),
      inlinePolicies: {
        S3ExportPolicy: s3ExportPolicy,
      },
    });

    const dbClusterName = "analytics-cluster";
    const dbCluster = new rds.DatabaseCluster(this, "AnalyticsDbCluster", {
      engine: dbEngine,
      writer: rds.ClusterInstance.serverlessV2("writer", {
        enablePerformanceInsights: true,
        parameterGroup,
      }),
      readers: [
        rds.ClusterInstance.serverlessV2("reader", {
          enablePerformanceInsights: true,
          parameterGroup,
        }),
      ],
      vpc: ownProps.vpc,
      preferredMaintenanceWindow: dbConfig.maintenanceWindow,
      credentials: dbCreds,
      defaultDatabaseName: dbConfig.name,
      clusterIdentifier: dbClusterName,
      storageEncrypted: true,
      parameterGroup,
      cloudwatchLogsExports: ["postgresql"],
      deletionProtection: true,
      removalPolicy: RemovalPolicy.RETAIN,
      storageType: rds.DBClusterStorageType.AURORA_IOPT1,
    });
    Aspects.of(dbCluster).add({
      visit(node) {
        if (node instanceof rds.CfnDBCluster) {
          node.serverlessV2ScalingConfiguration = {
            minCapacity: dbConfig.minCapacity,
            maxCapacity: dbConfig.maxCapacity,
          };
        }
      },
    });

    const cfnDbCluster = dbCluster.node.defaultChild as rds.CfnDBCluster;
    cfnDbCluster.associatedRoles = [
      {
        roleArn: dbClusterS3ImportRole.roleArn,
        featureName: "s3Import",
      },
      {
        roleArn: dbClusterS3ExportRole.roleArn,
        featureName: "s3Export",
      },
    ];

    addDBClusterAlertsAndAlarms({
      scope: this,
      dbCluster,
      dbClusterName,
      dbConfig,
      alertAction: ownProps.alertAction,
      alarmAction: ownProps.alarmAction,
    });

    return { dbCluster, dbCredsSecret };
  }

  private setupFhirToCsvBulkLambda(ownProps: {
    config: EnvConfigNonSandbox;
    envType: EnvType;
    awsRegion: string;
    lambdaLayers: LambdaLayers;
    vpc: ec2.IVpc;
    sentryDsn: string | undefined;
    alertAction: SnsAction | undefined;
    fhirToCsvTransformLambda: lambda.DockerImageFunction;
    featureFlagsTable: dynamodb.Table;
    medicalDocumentsBucket: s3.Bucket;
  }): {
    lambda: lambda.Function;
    queue: Queue;
  } {
    const {
      lambdaLayers,
      vpc,
      envType,
      sentryDsn,
      alertAction,
      fhirToCsvTransformLambda,
      featureFlagsTable,
    } = ownProps;

    const {
      name,
      entry,
      lambda: lambdaSettings,
      queue: queueSettings,
      eventSource: eventSourceSettings,
      waitTime,
    } = settings().fhirToCsvBulk;

    const queue = createQueue({
      ...queueSettings,
      stack: this,
      name,
      fifo: true,
      createDLQ: true,
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
        // API_URL set on the api-stack after the OSS API is created
        WAIT_TIME_IN_MILLIS: waitTime.toMilliseconds().toString(),
        FHIR_TO_CSV_TRANSFORM_LAMBDA_NAME: fhirToCsvTransformLambda.functionName,
        FEATURE_FLAGS_TABLE_NAME: featureFlagsTable.tableName,
        MEDICAL_DOCUMENTS_BUCKET_NAME: ownProps.medicalDocumentsBucket.bucketName,
        ...(sentryDsn ? { SENTRY_DSN: sentryDsn } : {}),
      },
      layers: [lambdaLayers.shared],
      vpc,
      alertSnsAction: alertAction,
    });

    lambda.addEventSource(new SqsEventSource(queue, eventSourceSettings));

    fhirToCsvTransformLambda.grantInvoke(lambda);
    featureFlagsTable.grantReadData(lambda);
    ownProps.medicalDocumentsBucket.grantRead(lambda);

    return { lambda, queue };
  }

  private setupFhirToCsvIncrementalLambda(ownProps: {
    config: EnvConfigNonSandbox;
    envType: EnvType;
    awsRegion: string;
    lambdaLayers: LambdaLayers;
    vpc: ec2.IVpc;
    sentryDsn: string | undefined;
    alertAction: SnsAction | undefined;
    analyticsPlatformBucket: s3.Bucket;
    fhirToCsvTransformLambda: lambda.DockerImageFunction;
    featureFlagsTable: dynamodb.Table;
    medicalDocumentsBucket: s3.Bucket;
    dbCluster: rds.DatabaseCluster;
    fhirToCsvDbPassword: secret.ISecret;
  }): {
    lambda: lambda.Function;
    queue: Queue;
  } {
    const {
      lambdaLayers,
      vpc,
      envType,
      sentryDsn,
      alertAction,
      fhirToCsvTransformLambda,
      analyticsPlatformBucket,
      featureFlagsTable,
      medicalDocumentsBucket,
      dbCluster,
      fhirToCsvDbPassword,
      config,
    } = ownProps;

    const {
      name,
      entry,
      lambda: lambdaSettings,
      queue: queueSettings,
      eventSource: eventSourceSettings,
      waitTime,
    } = settings().fhirToCsvIncremental;

    const queue = createQueue({
      ...queueSettings,
      stack: this,
      name,
      fifo: true,
      createDLQ: true,
      envType,
      alertSnsAction: alertAction,
      deliveryDelay: queueSettings.deliveryDelay,
    });

    const dbCreds: DatabaseCredsForLambda = {
      host: ownProps.dbCluster.clusterEndpoint.hostname,
      port: ownProps.dbCluster.clusterEndpoint.port,
      engine: "postgres" as const,
      dbname: config.analyticsPlatform.rds.name,
      username: config.analyticsPlatform.rds.fhirToCsvDbUsername,
      passwordSecretArn: fhirToCsvDbPassword.secretArn,
    };

    // TODO ENG-1029 for reference only for now
    // const dbReadOnlyCreds: DatabaseCredsForLambda = {
    //   host: ownProps.dbCluster.clusterReadEndpoint.hostname,
    //   port: ownProps.dbCluster.clusterReadEndpoint.port,
    //   ...
    // };

    const lambda = createLambda({
      ...lambdaSettings,
      stack: this,
      name,
      entry,
      envType,
      envVars: {
        // API_URL set on the api-stack after the OSS API is created
        WAIT_TIME_IN_MILLIS: waitTime.toMilliseconds().toString(),
        FHIR_TO_CSV_TRANSFORM_LAMBDA_NAME: fhirToCsvTransformLambda.functionName,
        ANALYTICS_BUCKET_NAME: analyticsPlatformBucket.bucketName,
        FEATURE_FLAGS_TABLE_NAME: featureFlagsTable.tableName,
        MEDICAL_DOCUMENTS_BUCKET_NAME: medicalDocumentsBucket.bucketName,
        DB_CREDS: JSON.stringify(dbCreds),
        ...(sentryDsn ? { SENTRY_DSN: sentryDsn } : {}),
      },
      layers: [lambdaLayers.shared, lambdaLayers.analyticsPlatform],
      vpc,
      alertSnsAction: alertAction,
      isEnableInsights: true,
    });

    lambda.addEventSource(new SqsEventSource(queue, eventSourceSettings));

    dbCluster.connections.allowDefaultPortFrom(lambda);
    fhirToCsvDbPassword.grantRead(lambda);
    fhirToCsvTransformLambda.grantInvoke(lambda);
    analyticsPlatformBucket.grantReadWrite(lambda);
    featureFlagsTable.grantReadData(lambda);
    medicalDocumentsBucket.grantRead(lambda);

    return { lambda, queue };
  }

  private setupFhirToCsvTransformLambda(ownProps: {
    config: EnvConfigNonSandbox;
    envType: EnvType;
    awsRegion: string;
    lambdaLayers: LambdaLayers;
    vpc: ec2.IVpc;
    sentryDsn: string | undefined;
    alertAction: SnsAction | undefined;
    analyticsPlatformBucket: s3.Bucket;
    medicalDocumentsBucket: s3.Bucket;
  }): {
    fhirToCsvTransformLambda: lambda.DockerImageFunction;
  } {
    const { lambda: fhirToCsvTransformLambdaSettings, name: fhirToCsvTransformLambdaName } =
      settings().fhirToCsvTransform;

    // TODO Try to make this lambda to read from and write to SQS, then we don't need the FhirToCsv one
    const fhirToCsvTransformLambda = new lambda.DockerImageFunction(
      this,
      "FhirToCsvTransformLambda",
      {
        functionName: fhirToCsvTransformLambdaName,
        vpc: ownProps.vpc,
        code: lambda.DockerImageCode.fromImageAsset("../data-transformation/fhir-to-csv", {
          file: "Dockerfile.lambda",
          platform: Platform.LINUX_AMD64,
        }),
        timeout: fhirToCsvTransformLambdaSettings.timeout,
        memorySize: fhirToCsvTransformLambdaSettings.memory,
        ephemeralStorageSize: fhirToCsvTransformLambdaSettings.ephemeralStorageSize,
        environment: {
          ENV: ownProps.envType,
          INPUT_S3_BUCKET: ownProps.medicalDocumentsBucket.bucketName,
          OUTPUT_S3_BUCKET: ownProps.analyticsPlatformBucket.bucketName,
        },
      }
    );

    addErrorAlarmToLambdaFunc(
      this,
      fhirToCsvTransformLambda,
      `${fhirToCsvTransformLambdaName}-GeneralLambdaAlarm`,
      ownProps.alertAction
    );

    ownProps.analyticsPlatformBucket.grantReadWrite(fhirToCsvTransformLambda);
    ownProps.medicalDocumentsBucket.grantRead(fhirToCsvTransformLambda);

    return { fhirToCsvTransformLambda };
  }

  private setupMergeCsvsLambda(ownProps: {
    config: EnvConfigNonSandbox;
    envType: EnvType;
    awsRegion: string;
    lambdaLayers: LambdaLayers;
    vpc: ec2.IVpc;
    sentryDsn: string | undefined;
    alertAction: SnsAction | undefined;
    bucket: s3.Bucket;
  }): {
    mergeCsvsLambda: lambda.Function;
    queue: Queue;
  } {
    const { lambdaLayers, vpc, envType, sentryDsn, alertAction } = ownProps;
    const {
      name,
      entry,
      lambda: lambdaSettings,
      queue: queueSettings,
      eventSource: eventSourceSettings,
      waitTime,
    } = settings().mergeCsvs;

    const queue = createQueue({
      ...queueSettings,
      stack: this,
      name,
      fifo: true,
      createDLQ: true,
      envType,
      alertSnsAction: alertAction,
    });

    const mergeCsvsLambda = createLambda({
      ...lambdaSettings,
      stack: this,
      name,
      entry,
      envType,
      envVars: {
        // API_URL set on the api-stack after the OSS API is created
        WAIT_TIME_IN_MILLIS: waitTime.toMilliseconds().toString(),
        ANALYTICS_BUCKET_NAME: ownProps.bucket.bucketName,
        ...(sentryDsn ? { SENTRY_DSN: sentryDsn } : {}),
      },
      layers: [lambdaLayers.shared],
      vpc,
      alertSnsAction: alertAction,
    });

    mergeCsvsLambda.addEventSource(new SqsEventSource(queue, eventSourceSettings));
    ownProps.bucket.grantReadWrite(mergeCsvsLambda);

    return { mergeCsvsLambda, queue };
  }

  private setupCreateFhirTablesLambda(ownProps: {
    config: EnvConfigNonSandbox;
    envType: EnvType;
    lambdaLayers: LambdaLayers;
    vpc: ec2.IVpc;
    sentryDsn: string | undefined;
    alertAction: SnsAction | undefined;
    dbCluster: rds.DatabaseCluster;
    dbCredsSecret: secret.Secret;
    fhirToCsvDbUsername: string;
    rawToCoreDbUsername: string;
    fhirToCsvDbPassword: secret.ISecret;
    rawToCoreDbPassword: secret.ISecret;
    analyticsDbReaderCname: string;
  }): lambda.Function {
    const {
      lambdaLayers,
      vpc,
      envType,
      sentryDsn,
      alertAction,
      dbCluster,
      dbCredsSecret,
      fhirToCsvDbUsername,
      rawToCoreDbUsername,
      fhirToCsvDbPassword,
      rawToCoreDbPassword,
      analyticsDbReaderCname,
    } = ownProps;

    const { name, entry, lambda: lambdaSettings } = settings().createFhirTables;

    const lambda = createLambda({
      ...lambdaSettings,
      stack: this,
      name,
      entry,
      envType,
      envVars: {
        DB_CREDS_SECRET_ARN: dbCredsSecret.secretArn,
        RAW_TO_CORE_DB_USERNAME: rawToCoreDbUsername,
        FHIR_TO_CSV_DB_USERNAME: fhirToCsvDbUsername,
        RAW_TO_CORE_DB_PASSWORD_SECRET_ARN: rawToCoreDbPassword.secretArn,
        FHIR_TO_CSV_DB_PASSWORD_SECRET_ARN: fhirToCsvDbPassword.secretArn,
        ANALYTICS_DB_READER_HOST: dbCluster.clusterReadEndpoint.hostname,
        ANALYTICS_DB_READER_CNAME: analyticsDbReaderCname,
        ...(sentryDsn ? { SENTRY_DSN: sentryDsn } : {}),
      },
      layers: [lambdaLayers.shared, lambdaLayers.analyticsPlatform],
      vpc,
      alertSnsAction: alertAction,
      isEnableInsights: true,
    });

    dbCluster.connections.allowDefaultPortFrom(lambda);
    dbCredsSecret.grantRead(lambda);
    fhirToCsvDbPassword.grantRead(lambda);
    rawToCoreDbPassword.grantRead(lambda);

    return lambda;
  }

  private setupRawToCoreBatchJob(ownProps: {
    config: EnvConfigNonSandbox;
    envType: EnvType;
    awsRegion: string;
    vpc: ec2.IVpc;
    dbCluster: rds.DatabaseCluster;
    rawToCoreDbPassword: secret.ISecret;
    computeEnvironment: batch.FargateComputeEnvironment;
  }): {
    job: batch.EcsJobDefinition;
    container: batch.EcsFargateContainerDefinition;
    queue: batch.JobQueue;
  } {
    const { memory, cpu } = settings().rawToCore;

    const asset = new DockerImageAsset(this, "RawToCoreBuildImage", {
      directory: "../data-transformation/raw-to-core",
      file: "Dockerfile",
    });

    const container = new batch.EcsFargateContainerDefinition(this, "RawToCoreContainerDef", {
      image: ecs.ContainerImage.fromDockerImageAsset(asset),
      memory,
      cpu,
      environment: {
        ENV: ownProps.envType,
        AWS_REGION: ownProps.awsRegion,
        HOST: ownProps.dbCluster.clusterEndpoint.hostname,
        USER: ownProps.config.analyticsPlatform.rds.rawToCoreDbUsername,
      },
      secrets: {
        PASSWORD: batch.Secret.fromSecretsManager(ownProps.rawToCoreDbPassword),
      },
      command: [
        "python",
        "main.py",
        "Ref::database",
        "Ref::schema",
        "Ref::jobId",
        "Ref::fullRefresh",
        "Ref::lookbackTimestamp",
        "Ref::lookbackHours",
      ],
    });

    const job = new batch.EcsJobDefinition(this, "RawToCoreBatchJob", {
      jobDefinitionName: "RawToCoreBatchJob",
      container,
      parameters: {
        database: "default",
        schema: "default",
      },
    });

    const queue = new batch.JobQueue(this, "RawToCoreJobQueue", {
      computeEnvironments: [
        {
          computeEnvironment: ownProps.computeEnvironment,
          order: 1,
        },
      ],
      priority: 10,
    });

    ownProps.rawToCoreDbPassword.grantRead(container.executionRole);

    return { job, container, queue };
  }

  private setupRawToCoreTriggerLambda(ownProps: {
    config: EnvConfigNonSandbox;
    envType: EnvType;
    lambdaLayers: LambdaLayers;
    vpc: ec2.IVpc;
    sentryDsn: string | undefined;
    alertAction: SnsAction | undefined;
    rawToCoreBatchJob: batch.EcsJobDefinition;
    rawToCoreBatchJobQueue: batch.JobQueue;
    featureFlagsTable: dynamodb.Table;
  }): { lambda: lambda.Function; queue: Queue } {
    const {
      lambdaLayers,
      vpc,
      envType,
      sentryDsn,
      alertAction,
      rawToCoreBatchJob,
      rawToCoreBatchJobQueue,
      featureFlagsTable,
    } = ownProps;

    const {
      name,
      entry,
      lambda: lambdaSettings,
      queue: queueSettings,
      eventSource: eventSourceSettings,
    } = settings().rawToCoreTrigger;

    const queue = createQueue({
      ...queueSettings,
      stack: this,
      name,
      fifo: true,
      createDLQ: true,
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
        FEATURE_FLAGS_TABLE_NAME: featureFlagsTable.tableName,
        RAW_TO_CORE_BATCH_JOB_QUEUE_ARN: rawToCoreBatchJobQueue.jobQueueArn,
        RAW_TO_CORE_BATCH_JOB_DEFINITION_ARN: rawToCoreBatchJob.jobDefinitionArn,
        ...(sentryDsn ? { SENTRY_DSN: sentryDsn } : {}),
      },
      layers: [lambdaLayers.shared],
      vpc,
      alertSnsAction: alertAction,
    });

    lambda.addEventSource(new SqsEventSource(queue, eventSourceSettings));

    featureFlagsTable.grantReadData(lambda);
    lambda.addToRolePolicy(
      new iam.PolicyStatement({
        actions: ["batch:SubmitJob"],
        resources: [rawToCoreBatchJob.jobDefinitionArn, rawToCoreBatchJobQueue.jobQueueArn],
      })
    );

    return { lambda: lambda, queue };
  }

  private setupRawToCoreCompletionHandlerLambda(ownProps: {
    envType: EnvType;
    lambdaLayers: LambdaLayers;
    vpc: ec2.IVpc;
    sentryDsn: string | undefined;
    alertAction: SnsAction | undefined;
    rawToCoreBatchJob: batch.EcsJobDefinition;
    rawToCoreCompletionTopic: sns.Topic;
    featureFlagsTable: dynamodb.Table;
  }): { lambda: lambda.Function } {
    const {
      lambdaLayers,
      vpc,
      envType,
      sentryDsn,
      alertAction,
      rawToCoreBatchJob,
      rawToCoreCompletionTopic,
      featureFlagsTable,
    } = ownProps;

    const { name, entry, lambda: lambdaSettings } = settings().rawToCoreCompletionHandler;

    const completionHandlerLambda = createLambda({
      ...lambdaSettings,
      stack: this,
      name,
      entry,
      envType,
      envVars: {
        RAW_TO_CORE_COMPLETION_TOPIC_ARN: rawToCoreCompletionTopic.topicArn,
        FEATURE_FLAGS_TABLE_NAME: featureFlagsTable.tableName,
        ...(sentryDsn ? { SENTRY_DSN: sentryDsn } : {}),
      },
      layers: [lambdaLayers.shared],
      vpc,
      alertSnsAction: alertAction,
    });

    rawToCoreCompletionTopic.grantPublish(completionHandlerLambda);
    featureFlagsTable.grantReadWriteData(completionHandlerLambda);

    const eventRule = new events.Rule(this, "RawToCoreJobStateChangeRule", {
      ruleName: `raw-to-core-job-state-change-${envType}`,
      description:
        "Rule to capture Raw to Core batch job state changes and trigger completion handler",
      eventPattern: {
        source: ["aws.batch"],
        detailType: ["Batch Job State Change"],
        detail: {
          jobDefinition: [rawToCoreBatchJob.jobDefinitionArn],
          status: ["SUCCEEDED"],
        },
      },
    });

    eventRule.addTarget(new targets.LambdaFunction(completionHandlerLambda));

    return { lambda: completionHandlerLambda };
  }

  private setupCoreToHedisBatchJob(ownProps: {
    config: EnvConfigNonSandbox;
    envType: EnvType;
    awsRegion: string;
    vpc: ec2.IVpc;
    dbCluster: rds.DatabaseCluster;
    rawToCoreDbPassword: secret.ISecret;
    computeEnvironment: batch.FargateComputeEnvironment;
  }): {
    job: batch.EcsJobDefinition;
    container: batch.EcsFargateContainerDefinition;
    queue: batch.JobQueue;
  } {
    const { memory, cpu } = settings().coreToHedis;

    
    const container = new batch.EcsFargateContainerDefinition(this, "CoreToHedisContainerDef", {
      image: ecs.ContainerImage.fromRegistry("public.ecr.aws/docker/library/busybox:1.36"),
      memory,
      cpu,
      environment: {
        ENV: ownProps.envType,
        AWS_REGION: ownProps.awsRegion,
        HOST: ownProps.dbCluster.clusterEndpoint.hostname,
        USER: ownProps.config.analyticsPlatform.rds.rawToCoreDbUsername,
      },
      secrets: {
        PASSWORD: batch.Secret.fromSecretsManager(ownProps.rawToCoreDbPassword),
      },
      command: ["python", "main.py", "Ref::database", "Ref::schema"],
    });

    const job = new batch.EcsJobDefinition(this, "CoreToHedisBatchJob", {
      jobDefinitionName: "CoreToHedisBatchJob",
      container,
      parameters: {
        database: "default",
        schema: "default",
      },
    });

    const queue = new batch.JobQueue(this, "CoreToHedisJobQueue", {
      computeEnvironments: [
        {
          computeEnvironment: ownProps.computeEnvironment,
          order: 1,
        },
      ],
      priority: 10,
    });

    ownProps.rawToCoreDbPassword.grantRead(container.executionRole);

    return { job, container, queue };
  }

  private setupCoreToHedisTriggerLambda(ownProps: {
    config: EnvConfigNonSandbox;
    envType: EnvType;
    lambdaLayers: LambdaLayers;
    vpc: ec2.IVpc;
    sentryDsn: string | undefined;
    alertAction: SnsAction | undefined;
    coreToHedisBatchJob: batch.EcsJobDefinition;
    coreToHedisBatchJobQueue: batch.JobQueue;
    featureFlagsTable: dynamodb.Table;
  }): { lambda: lambda.Function; queue: Queue } {
    const {
      lambdaLayers,
      vpc,
      envType,
      sentryDsn,
      alertAction,
      coreToHedisBatchJob,
      coreToHedisBatchJobQueue,
      featureFlagsTable,
    } = ownProps;

    const {
      name,
      entry,
      lambda: lambdaSettings,
      queue: queueSettings,
      eventSource: eventSourceSettings,
    } = settings().coreToHedisTrigger;

    const queue = createQueue({
      ...queueSettings,
      stack: this,
      name,
      fifo: true,
      createDLQ: true,
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
        FEATURE_FLAGS_TABLE_NAME: featureFlagsTable.tableName,
        CORE_TO_HEDIS_BATCH_JOB_QUEUE_ARN: coreToHedisBatchJobQueue.jobQueueArn,
        CORE_TO_HEDIS_BATCH_JOB_DEFINITION_ARN: coreToHedisBatchJob.jobDefinitionArn,
        ...(sentryDsn ? { SENTRY_DSN: sentryDsn } : {}),
      },
      layers: [lambdaLayers.shared],
      vpc,
      alertSnsAction: alertAction,
    });

    lambda.addEventSource(new SqsEventSource(queue, eventSourceSettings));

    featureFlagsTable.grantReadData(lambda);
    lambda.addToRolePolicy(
      new iam.PolicyStatement({
        actions: ["batch:SubmitJob"],
        resources: [coreToHedisBatchJob.jobDefinitionArn, coreToHedisBatchJobQueue.jobQueueArn],
      })
    );

    return { lambda: lambda, queue };
  }

  private setupCoreToHedisCompletionHandlerLambda(ownProps: {
    envType: EnvType;
    lambdaLayers: LambdaLayers;
    vpc: ec2.IVpc;
    sentryDsn: string | undefined;
    alertAction: SnsAction | undefined;
    coreToHedisBatchJob: batch.EcsJobDefinition;
    coreToHedisCompletionTopic: sns.Topic;
    featureFlagsTable: dynamodb.Table;
  }): { lambda: lambda.Function } {
    const {
      lambdaLayers,
      vpc,
      envType,
      sentryDsn,
      alertAction,
      coreToHedisBatchJob,
      coreToHedisCompletionTopic,
      featureFlagsTable,
    } = ownProps;

    const { name, entry, lambda: lambdaSettings } = settings().coreToHedisCompletionHandler;

    const completionHandlerLambda = createLambda({
      ...lambdaSettings,
      stack: this,
      name,
      entry,
      envType,
      envVars: {
        CORE_TO_HEDIS_COMPLETION_TOPIC_ARN: coreToHedisCompletionTopic.topicArn,
        FEATURE_FLAGS_TABLE_NAME: featureFlagsTable.tableName,
        ...(sentryDsn ? { SENTRY_DSN: sentryDsn } : {}),
      },
      layers: [lambdaLayers.shared],
      vpc,
      alertSnsAction: alertAction,
    });

    coreToHedisCompletionTopic.grantPublish(completionHandlerLambda);
    featureFlagsTable.grantReadData(completionHandlerLambda);

    const eventRule = new events.Rule(this, "CoreToHedisJobStateChangeRule", {
      ruleName: `core-to-hedis-job-state-change-${envType}`,
      description:
        "Rule to capture Core to HEDIS batch job state changes and trigger completion handler",
      eventPattern: {
        source: ["aws.batch"],
        detailType: ["Batch Job State Change"],
        detail: {
          jobDefinition: [coreToHedisBatchJob.jobDefinitionArn],
          status: ["SUCCEEDED"],
        },
      },
    });

    eventRule.addTarget(new targets.LambdaFunction(completionHandlerLambda));

    return { lambda: completionHandlerLambda };
  }

  private setupExportCoreFromFwhToS3BatchJob(ownProps: {
    config: EnvConfigNonSandbox;
    envType: EnvType;
    awsRegion: string;
    vpc: ec2.IVpc;
    analyticsPlatformBucket: s3.Bucket;
    dbCluster: rds.DatabaseCluster;
    rawToCoreDbPassword: secret.ISecret;
    computeEnvironment: batch.FargateComputeEnvironment;
    exportCoreFromFwhToS3CompletionTopic: sns.Topic;
  }): {
    job: batch.EcsJobDefinition;
    container: batch.EcsFargateContainerDefinition;
    queue: batch.JobQueue;
  } {
    const { memory, cpu } = settings().exportCoreFromFwhToS3Batch;

    
    const exportCoreJobRole = new iam.Role(this, "ExportCoreFromFwhToS3JobRole", {
      roleName: `ExportCoreFromFwhToS3JobRole-${ownProps.envType}`,
      assumedBy: new iam.ServicePrincipal("ecs-tasks.amazonaws.com"),
    });

    const container = new batch.EcsFargateContainerDefinition(
      this,
      "ExportCoreFromFwhToS3ContainerDef",
      {
        image: ecs.ContainerImage.fromRegistry("public.ecr.aws/docker/library/busybox:1.36"),
        memory,
        cpu,
        jobRole: exportCoreJobRole,
        environment: {
          ENV_TYPE: ownProps.envType,
          AWS_REGION: ownProps.awsRegion,
          HOST: ownProps.dbCluster.clusterReadEndpoint.hostname,
          PORT: ownProps.dbCluster.clusterReadEndpoint.port.toString(),
          USER: ownProps.config.analyticsPlatform.rds.rawToCoreDbUsername,
          DBNAME: ownProps.config.analyticsPlatform.rds.name,
          ENGINE: "postgres" as const,
          ANALYTICS_BUCKET_NAME: ownProps.analyticsPlatformBucket.bucketName,
          EXPORT_CORE_FROM_FWH_TO_S3_COMPLETION_TOPIC_ARN:
            ownProps.exportCoreFromFwhToS3CompletionTopic.topicArn,
          AWS_SDK_LOAD_CONFIG: "1",
        },
        secrets: {
          PASSWORD: batch.Secret.fromSecretsManager(ownProps.rawToCoreDbPassword),
        },
        command: ["Ref::cxId", "Ref::rawToCoreJobId", "Ref::jobId"],
      }
    );

    const job = new batch.EcsJobDefinition(this, "ExportCoreFromFwhToS3BatchJob", {
      jobDefinitionName: "ExportCoreFromFwhToS3BatchJob",
      container,
      parameters: {
        cxId: "default",
        jobId: "default",
        rawToCoreJobId: "default",
      },
    });

    const queue = new batch.JobQueue(this, "ExportCoreFromFwhToS3JobQueue", {
      computeEnvironments: [
        {
          computeEnvironment: ownProps.computeEnvironment,
          order: 1,
        },
      ],
      priority: 10,
    });

    ownProps.rawToCoreDbPassword.grantRead(container.executionRole);
    ownProps.analyticsPlatformBucket.grantReadWrite(exportCoreJobRole);
    ownProps.exportCoreFromFwhToS3CompletionTopic.grantPublish(exportCoreJobRole);

    return { job, container, queue };
  }

  private setupExportCoreFromFwhToS3TriggerLambda(ownProps: {
    config: EnvConfigNonSandbox;
    envType: EnvType;
    lambdaLayers: LambdaLayers;
    vpc: ec2.IVpc;
    sentryDsn: string | undefined;
    alertAction: SnsAction | undefined;
    exportCoreFromFwhToS3BatchJob: batch.EcsJobDefinition;
    exportCoreFromFwhToS3BatchJobQueue: batch.JobQueue;
    featureFlagsTable: dynamodb.Table;
  }): { lambda: lambda.Function; queue: Queue } {
    const {
      lambdaLayers,
      vpc,
      envType,
      sentryDsn,
      alertAction,
      exportCoreFromFwhToS3BatchJob,
      exportCoreFromFwhToS3BatchJobQueue,
      featureFlagsTable,
    } = ownProps;

    const {
      name,
      entry,
      lambda: lambdaSettings,
      queue: queueSettings,
      eventSource: eventSourceSettings,
    } = settings().exportCoreFromFwhToS3Trigger;

    const queue = createQueue({
      ...queueSettings,
      stack: this,
      name,
      fifo: true,
      createDLQ: true,
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
        FEATURE_FLAGS_TABLE_NAME: featureFlagsTable.tableName,
        EXPORT_CORE_FROM_FWH_TO_S3_BATCH_JOB_QUEUE_ARN:
          exportCoreFromFwhToS3BatchJobQueue.jobQueueArn,
        EXPORT_CORE_FROM_FWH_TO_S3_BATCH_JOB_DEFINITION_ARN:
          exportCoreFromFwhToS3BatchJob.jobDefinitionArn,
        ...(sentryDsn ? { SENTRY_DSN: sentryDsn } : {}),
      },
      layers: [lambdaLayers.shared],
      vpc,
      alertSnsAction: alertAction,
    });

    lambda.addEventSource(new SqsEventSource(queue, eventSourceSettings));

    featureFlagsTable.grantReadData(lambda);
    lambda.addToRolePolicy(
      new iam.PolicyStatement({
        actions: ["batch:SubmitJob"],
        resources: [
          exportCoreFromFwhToS3BatchJob.jobDefinitionArn,
          exportCoreFromFwhToS3BatchJobQueue.jobQueueArn,
        ],
      })
    );

    return { lambda: lambda, queue };
  }

  private setupSnowflakeConnectorBatchJob(ownProps: {
    config: EnvConfigNonSandbox;
    envType: EnvType;
    awsRegion: string;
    vpc: ec2.IVpc;
    analyticsPlatformBucket: s3.Bucket;
    computeEnvironment: batch.FargateComputeEnvironment;
    snowflakeCredsForAllRegionsSecret: secret.ISecret;
    snowflakeSettingsForAllCxsSecret: secret.ISecret;
    connectorIngestionCompleteTopic: sns.Topic;
  }): {
    job: batch.EcsJobDefinition;
    container: batch.EcsFargateContainerDefinition;
    queue: batch.JobQueue;
  } {
    const { memory, cpu } = settings().snowflakeConnectorBatch;

    
    const snowflakeConnectorJobRole = new iam.Role(this, "SnowflakeConnectorJobRole", {
      roleName: `SnowflakeConnectorJobRole-${ownProps.envType}`,
      assumedBy: new iam.ServicePrincipal("ecs-tasks.amazonaws.com"),
    });

    const container = new batch.EcsFargateContainerDefinition(
      this,
      "SnowflakeConnectorContainerDef",
      {
        image: ecs.ContainerImage.fromRegistry("public.ecr.aws/docker/library/busybox:1.36"),
        memory,
        cpu,
        jobRole: snowflakeConnectorJobRole,
        environment: {
          ENV_TYPE: ownProps.envType,
          AWS_REGION: ownProps.awsRegion,
          ANALYTICS_BUCKET_NAME: ownProps.analyticsPlatformBucket.bucketName,
          CONNECTOR_INGESTION_COMPLETE_TOPIC_ARN: ownProps.connectorIngestionCompleteTopic.topicArn,
          AWS_SDK_LOAD_CONFIG: "1",
        },
        secrets: {
          SNOWFLAKE_CREDS_FOR_ALL_REGIONS: batch.Secret.fromSecretsManager(
            ownProps.snowflakeCredsForAllRegionsSecret
          ),
          SNOWFLAKE_SETTINGS_FOR_ALL_CXS: batch.Secret.fromSecretsManager(
            ownProps.snowflakeSettingsForAllCxsSecret
          ),
        },
        command: ["Ref::cxId", "Ref::coreExportJobId", "Ref::jobId"],
      }
    );

    const job = new batch.EcsJobDefinition(this, "SnowflakeConnectorBatchJob", {
      jobDefinitionName: "SnowflakeConnectorBatchJob",
      container,
      parameters: {
        cxId: "default",
        jobId: "default",
        coreExportJobId: "default",
      },
    });

    const queue = new batch.JobQueue(this, "SnowflakeConnectorJobQueue", {
      computeEnvironments: [
        {
          computeEnvironment: ownProps.computeEnvironment,
          order: 1,
        },
      ],
      priority: 10,
    });

    ownProps.snowflakeCredsForAllRegionsSecret.grantRead(container.executionRole);
    ownProps.snowflakeSettingsForAllCxsSecret.grantRead(container.executionRole);
    ownProps.analyticsPlatformBucket.grantReadWrite(snowflakeConnectorJobRole);
    ownProps.connectorIngestionCompleteTopic.grantPublish(snowflakeConnectorJobRole);

    return { job, container, queue };
  }

  private setupSnowflakeConnectorTriggerLambda(ownProps: {
    config: EnvConfigNonSandbox;
    envType: EnvType;
    lambdaLayers: LambdaLayers;
    vpc: ec2.IVpc;
    sentryDsn: string | undefined;
    alertAction: SnsAction | undefined;
    snowflakeConnectorBatchJob: batch.EcsJobDefinition;
    snowflakeConnectorBatchJobQueue: batch.JobQueue;
    featureFlagsTable: dynamodb.Table;
  }): { lambda: lambda.Function; queue: Queue } {
    const {
      lambdaLayers,
      vpc,
      envType,
      sentryDsn,
      alertAction,
      snowflakeConnectorBatchJob,
      snowflakeConnectorBatchJobQueue,
      featureFlagsTable,
    } = ownProps;

    const {
      name,
      entry,
      lambda: lambdaSettings,
      queue: queueSettings,
      eventSource: eventSourceSettings,
    } = settings().snowflakeConnectorTrigger;

    const queue = createQueue({
      ...queueSettings,
      stack: this,
      name,
      fifo: true,
      createDLQ: true,
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
        FEATURE_FLAGS_TABLE_NAME: featureFlagsTable.tableName,
        SNOWFLAKE_CONNECTOR_BATCH_JOB_QUEUE_ARN: snowflakeConnectorBatchJobQueue.jobQueueArn,
        SNOWFLAKE_CONNECTOR_BATCH_JOB_DEFINITION_ARN: snowflakeConnectorBatchJob.jobDefinitionArn,
        ...(sentryDsn ? { SENTRY_DSN: sentryDsn } : {}),
      },
      layers: [lambdaLayers.shared, lambdaLayers.analyticsPlatform],
      vpc,
      alertSnsAction: alertAction,
    });

    lambda.addEventSource(new SqsEventSource(queue, eventSourceSettings));

    featureFlagsTable.grantReadData(lambda);
    lambda.addToRolePolicy(
      new iam.PolicyStatement({
        actions: ["batch:SubmitJob"],
        resources: [
          snowflakeConnectorBatchJob.jobDefinitionArn,
          snowflakeConnectorBatchJobQueue.jobQueueArn,
        ],
      })
    );

    return { lambda: lambda, queue };
  }

  private setupAnalyticsWebhookConsumerLambda(ownProps: {
    config: EnvConfigNonSandbox;
    envType: EnvType;
    lambdaLayers: LambdaLayers;
    vpc: ec2.IVpc;
    sentryDsn: string | undefined;
    alertAction: SnsAction | undefined;
    featureFlagsTable: dynamodb.Table;
  }): { lambda: lambda.Function; queue: Queue } {
    const { lambdaLayers, vpc, envType, sentryDsn, alertAction, featureFlagsTable } = ownProps;

    const {
      name,
      entry,
      lambda: lambdaSettings,
      queue: queueSettings,
      eventSource: eventSourceSettings,
    } = settings().analyticsWebhookConsumer;

    const queue = createQueue({
      ...queueSettings,
      stack: this,
      name,
      fifo: true,
      createDLQ: true,
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
        FEATURE_FLAGS_TABLE_NAME: featureFlagsTable.tableName,
        // API_URL set on the api-stack after the OSS API is created
        ...(sentryDsn ? { SENTRY_DSN: sentryDsn } : {}),
      },
      layers: [lambdaLayers.shared],
      vpc,
      alertSnsAction: alertAction,
    });

    lambda.addEventSource(new SqsEventSource(queue, eventSourceSettings));

    featureFlagsTable.grantReadData(lambda);

    return { lambda: lambda, queue };
  }

  private setupHedisCliLambda(ownProps: {
    config: EnvConfigNonSandbox;
    envType: EnvType;
    awsRegion: string;
    vpc: ec2.IVpc;
    alertAction: SnsAction | undefined;
    analyticsPlatformBucket: s3.Bucket;
    medicalDocumentsBucket: s3.Bucket;
  }): {
    hedisCliLambda: lambda.DockerImageFunction;
  } {
    const { lambda: hedisCliLambdaSettings, name: hedisCliLambdaName } = settings().hedisCli;

    const hedisCliLambda = new lambda.DockerImageFunction(this, "HedisCliLambda", {
      functionName: hedisCliLambdaName,
      vpc: ownProps.vpc,
      code: lambda.DockerImageCode.fromImageAsset(path.join(repoRoot, "packages/infra/placeholder-lambda-image"), { file: "Dockerfile" }),
      timeout: hedisCliLambdaSettings.timeout,
      memorySize: hedisCliLambdaSettings.memory,
      ephemeralStorageSize: hedisCliLambdaSettings.ephemeralStorageSize,
      environment: {
        ENV: ownProps.envType,
        ANALYTICS_BUCKET_NAME: ownProps.analyticsPlatformBucket.bucketName,
        HOME: "/tmp",
      },
    });

    addErrorAlarmToLambdaFunc(
      this,
      hedisCliLambda,
      `${hedisCliLambdaName}-GeneralLambdaAlarm`,
      ownProps.alertAction
    );

    ownProps.analyticsPlatformBucket.grantReadWrite(hedisCliLambda);
    ownProps.medicalDocumentsBucket.grantRead(hedisCliLambda);

    return { hedisCliLambda };
  }

  private setupCqlTransformLambda(ownProps: {
    config: EnvConfigNonSandbox;
    envType: EnvType;
    awsRegion: string;
    lambdaLayers: LambdaLayers;
    vpc: ec2.IVpc;
    sentryDsn: string | undefined;
    alertAction: SnsAction | undefined;
    analyticsPlatformBucket: s3.Bucket;
    hedisCliLambda: lambda.DockerImageFunction;
  }): {
    lambda: lambda.Function;
    queue: Queue;
  } {
    const {
      lambdaLayers,
      vpc,
      envType,
      sentryDsn,
      alertAction,
      analyticsPlatformBucket,
      hedisCliLambda,
    } = ownProps;

    const {
      name,
      entry,
      lambda: lambdaSettings,
      queue: queueSettings,
      eventSource: eventSourceSettings,
      waitTime,
    } = settings().cqlTransform;

    const queue = createQueue({
      ...queueSettings,
      stack: this,
      name,
      fifo: true,
      createDLQ: true,
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
        WAIT_TIME_IN_MILLIS: waitTime.toMilliseconds().toString(),
        HEDIS_CLI_LAMBDA_NAME: hedisCliLambda.functionName,
        ANALYTICS_BUCKET_NAME: analyticsPlatformBucket.bucketName,
        ...(sentryDsn ? { SENTRY_DSN: sentryDsn } : {}),
      },
      layers: [lambdaLayers.shared],
      vpc,
      alertSnsAction: alertAction,
    });

    lambda.addEventSource(new SqsEventSource(queue, eventSourceSettings));

    hedisCliLambda.grantInvoke(lambda);
    analyticsPlatformBucket.grantReadWrite(lambda);

    return { lambda, queue };
  }
}
