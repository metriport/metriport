import {
  EcsFargateContainerDefinitionProps,
  EcsJobDefinition,
  JobQueue,
} from "aws-cdk-lib/aws-batch";
import { Function as Lambda } from "aws-cdk-lib/aws-lambda";
import * as s3 from "aws-cdk-lib/aws-s3";
import * as sns from "aws-cdk-lib/aws-sns";
import { Queue } from "aws-cdk-lib/aws-sqs";

export type AnalyticsPlatformsAssets = {
  fhirToCsvBulkLambda: Lambda;
  fhirToCsvBulkQueue: Queue;
  fhirToCsvIncrementalLambda: Lambda;
  fhirToCsvIncrementalQueue: Queue;
  mergeCsvsLambda: Lambda;
  mergeCsvsQueue: Queue;
  coreTransformBatchJob: EcsJobDefinition;
  coreTransformBatchJobContainer: EcsFargateContainerDefinitionProps;
  coreTransformBatchJobQueue: JobQueue;
  analyticsPlatformBucket: s3.Bucket;
  coreTransformJobCompletionTopic: sns.Topic;
};
