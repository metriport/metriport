import { Function as Lambda } from "aws-cdk-lib/aws-lambda";
import * as s3 from "aws-cdk-lib/aws-s3";
import { Queue } from "aws-cdk-lib/aws-sqs";

export type AnalyticsPlatformsAssets = {
  fhirToCsvBulkLambda: Lambda;
  fhirToCsvBulkQueue: Queue;
  fhirToCsvIncrementalLambda: Lambda;
  fhirToCsvIncrementalQueue: Queue;
  mergeCsvsLambda: Lambda;
  mergeCsvsQueue: Queue;
  rawToCoreTransformLambda: Lambda;
  coreTransformScheduledLambda: Lambda;
  coreTransformLambda: Lambda;
  coreTransformQueue: Queue;
  analyticsPlatformBucket: s3.Bucket;
};
