import { Function as Lambda } from "aws-cdk-lib/aws-lambda";
import { Queue } from "aws-cdk-lib/aws-sqs";

export type JobsAssets = {
  triggerPatientJobsLambda: Lambda;
  runPatientJobQueue: Queue;
  runPatientJobLambda: Lambda;
};
