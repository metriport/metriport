import { Function as Lambda } from "aws-cdk-lib/aws-lambda";
import { Bucket } from "aws-cdk-lib/aws-s3";
import { Queue } from "aws-cdk-lib/aws-sqs";

export type QuestAssets = {
  sftpActionLambda: Lambda;
  rosterUploadLambda: Lambda;
  ingestAllResponsesLambda: Lambda;
  convertPatientResponseLambda: Lambda;
  convertPatientResponseQueue: Queue;
  questReplicaBucket: Bucket;
  labConversionBucket: Bucket;
  questLambdas: {
    envVarName: string;
    lambda: Lambda;
  }[];
  questQueues: {
    envVarName: string;
    queue: Queue;
  }[];
};
