import { Function as Lambda } from "aws-cdk-lib/aws-lambda";
import { Bucket } from "aws-cdk-lib/aws-s3";
import { Queue } from "aws-cdk-lib/aws-sqs";

export type SurescriptsAssets = {
  sftpActionLambda: Lambda;
  rosterUploadLambda: Lambda;
  ingestAllResponsesLambda: Lambda;
  convertBatchResponseLambda: Lambda;
  convertBatchResponseQueue: Queue;
  convertPatientResponseLambda: Lambda;
  convertPatientResponseQueue: Queue;
  surescriptsReplicaBucket: Bucket;
  pharmacyConversionBucket: Bucket;
  surescriptsLambdas: {
    envVarName: string;
    lambda: Lambda;
  }[];
  surescriptsQueues: {
    envVarName: string;
    queue: Queue;
  }[];
};
