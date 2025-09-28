import { Function as Lambda } from "aws-cdk-lib/aws-lambda";
import { EcsEc2ContainerDefinition, EcsJobDefinition, JobQueue } from "aws-cdk-lib/aws-batch";
import { Queue } from "aws-cdk-lib/aws-sqs";
import * as s3 from "aws-cdk-lib/aws-s3";

export type AnalyticsPlatformsAssets = {
  fhirToCsvBulkLambda: Lambda;
  fhirToCsvBulkQueue: Queue;
  fhirToCsvIncrementalLambda: Lambda;
  fhirToCsvIncrementalQueue: Queue;
  mergeCsvsLambda: Lambda;
  mergeCsvsQueue: Queue;
  coreTransformBatchJob: EcsJobDefinition;
  coreTransformBatchJobContainer: EcsEc2ContainerDefinition;
  coreTransformBatchJobQueue: JobQueue;
  analyticsPlatformBucket: s3.Bucket;
};
