import { EcsEc2ContainerDefinition, EcsJobDefinition, JobQueue } from "aws-cdk-lib/aws-batch";
import { DockerImageFunction } from "aws-cdk-lib/aws-lambda";
import { Queue } from "aws-cdk-lib/aws-sqs";

export type AnalyticsPlatformsAssets = {
  fhirToCsvLambda: DockerImageFunction;
  fhirToCsvTransformLambda: DockerImageFunction;
  fhirToCsvQueue: Queue;
  fhirToCsvBatchJob: EcsJobDefinition;
  fhirToCsvBatchJobContainer: EcsEc2ContainerDefinition;
  fhirToCsvBatchJobQueue: JobQueue;
};
