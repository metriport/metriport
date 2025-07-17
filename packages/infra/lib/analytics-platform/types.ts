import { EcsEc2ContainerDefinition, EcsJobDefinition, JobQueue } from "aws-cdk-lib/aws-batch";

export type AnalyticsPlatformsAssets = {
  fhirToCsvBatchJob: EcsJobDefinition;
  fhirToCsvContainer: EcsEc2ContainerDefinition;
  fhirToCsvQueue: JobQueue;
};
