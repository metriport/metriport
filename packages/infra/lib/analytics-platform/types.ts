import { EcsFargateContainerDefinition, EcsJobDefinition, JobQueue } from "aws-cdk-lib/aws-batch";
import { Function as Lambda } from "aws-cdk-lib/aws-lambda";
import * as s3 from "aws-cdk-lib/aws-s3";
import * as sns from "aws-cdk-lib/aws-sns";
import { Queue } from "aws-cdk-lib/aws-sqs";
import { Secret } from "aws-cdk-lib/aws-secretsmanager";

export type AnalyticsPlatformsAssets = {
  fhirToCsvBulkLambda: Lambda;
  fhirToCsvBulkQueue: Queue;
  fhirToCsvIncrementalLambda: Lambda;
  fhirToCsvIncrementalQueue: Queue;
  mergeCsvsLambda: Lambda;
  mergeCsvsQueue: Queue;
  coreTransformBatchJob: EcsJobDefinition;
  coreTransformBatchJobContainer: EcsFargateContainerDefinition;
  coreTransformBatchJobQueue: JobQueue;
  coreTransformScheduledLambda: Lambda;
  analyticsPlatformBucket: s3.Bucket;
  coreTransformJobCompletionTopic: sns.Topic;
  dbCredsSecret: Secret;
};
