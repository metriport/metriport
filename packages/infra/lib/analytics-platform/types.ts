import { DockerImageFunction } from "aws-cdk-lib/aws-lambda";
import { Queue } from "aws-cdk-lib/aws-sqs";

export type AnalyticsPlatformsAssets = {
  fhirToCsvLambda: DockerImageFunction;
  fhirToCsvQueue: Queue;
  mergeCsvsLambda: DockerImageFunction;
  mergeCsvsQueue: Queue;
};
