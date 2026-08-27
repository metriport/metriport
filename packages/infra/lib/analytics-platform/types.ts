import { EcsFargateContainerDefinition, EcsJobDefinition, JobQueue } from "aws-cdk-lib/aws-batch";
import { Function as Lambda } from "aws-cdk-lib/aws-lambda";
import * as s3 from "aws-cdk-lib/aws-s3";
import { ISecret, Secret } from "aws-cdk-lib/aws-secretsmanager";
import * as sns from "aws-cdk-lib/aws-sns";
import { Queue } from "aws-cdk-lib/aws-sqs";
import { SecretEnvVarNames } from "../../config/analytics-platform-config";

export type DbUserNames = Record<string, string>;
export type DbUserPasswordSecretNames = Record<SecretEnvVarNames, string>;

export type AnalyticsPlatformsAssets = {
  dbSecurityGroupId: string;
  analyticsDbReaderHost: string;
  analyticsPlatformBucket: s3.Bucket;
  dbCredsSecret: Secret;
  fhirToCsvBulkLambda: Lambda;
  fhirToCsvBulkQueue: Queue;
  fhirToCsvIncrementalLambda: Lambda;
  fhirToCsvIncrementalQueue: Queue;
  mergeCsvsLambda: Lambda;
  mergeCsvsQueue: Queue;
  createFhirTablesLambda: Lambda;
  // Raw to Core
  rawToCoreCompletionTopic: sns.Topic;
  rawToCoreTriggerLambda: Lambda;
  rawToCoreTriggerQueue: Queue;
  rawToCoreBatchJob: EcsJobDefinition;
  rawToCoreBatchJobContainer: EcsFargateContainerDefinition;
  rawToCoreBatchJobQueue: JobQueue;
  // Core to HEDIS
  coreToHedisCompletionTopic: sns.Topic;
  coreToHedisTriggerLambda: Lambda;
  coreToHedisTriggerQueue: Queue;
  coreToHedisBatchJob: EcsJobDefinition;
  coreToHedisBatchJobContainer: EcsFargateContainerDefinition;
  coreToHedisBatchJobQueue: JobQueue;
  // Export Core From FWH to S3
  exportCoreFromFwhToS3CompletionTopic: sns.Topic;
  exportCoreFromFwhToS3TriggerLambda: Lambda;
  exportCoreFromFwhToS3TriggerQueue: Queue;
  exportCoreFromFwhToS3BatchJob: EcsJobDefinition;
  exportCoreFromFwhToS3BatchJobContainer: EcsFargateContainerDefinition;
  exportCoreFromFwhToS3BatchJobQueue: JobQueue;
  // Connectors
  connectorIngestionCompleteTopic: sns.Topic;
  snowflakeConnectorTriggerLambda: Lambda;
  snowflakeConnectorTriggerQueue: Queue;
  snowflakeConnectorBatchJob: EcsJobDefinition;
  snowflakeConnectorBatchJobContainer: EcsFargateContainerDefinition;
  snowflakeConnectorBatchJobQueue: JobQueue;
  // Analytics Webhook Consumer
  analyticsWebhookConsumerLambda: Lambda;
  analyticsWebhookConsumerQueue: Queue;
  fhirToCsvUserName: string;
  rawToCoreUserName: string;
  fhirToCsvDbPassword: ISecret;
  rawToCoreDbPassword: ISecret;
  cqlTransformLambda: Lambda;
  cqlTransformQueue: Queue;
  hedisCliLambda: Lambda;
};
