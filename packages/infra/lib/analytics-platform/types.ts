import { Function as Lambda } from "aws-cdk-lib/aws-lambda";
import { Queue } from "aws-cdk-lib/aws-sqs";
import * as s3 from "aws-cdk-lib/aws-s3";

export type AnalyticsPlatformsAssets = {
  fhirToCsvBulkLambda: Lambda;
  fhirToCsvBulkQueue: Queue;
  fhirToCsvIncrementalLambda: Lambda;
  fhirToCsvIncrementalQueue: Queue;
  mergeCsvsLambda: Lambda;
  mergeCsvsQueue: Queue;
  rawToCoreTransformLambda: Lambda;
  analyticsPlatformBucket: s3.Bucket;
};
