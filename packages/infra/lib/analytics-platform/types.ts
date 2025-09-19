import { DockerImageFunction } from "aws-cdk-lib/aws-lambda";
import { Queue } from "aws-cdk-lib/aws-sqs";
import * as s3 from "aws-cdk-lib/aws-s3";

export type AnalyticsPlatformsAssets = {
  fhirToCsvLambda: DockerImageFunction;
  fhirToCsvQueue: Queue;
  mergeCsvsLambda: DockerImageFunction;
  mergeCsvsQueue: Queue;
  analyticsPlatformBucket: s3.Bucket;
};
