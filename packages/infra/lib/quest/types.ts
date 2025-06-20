import { Bucket } from "aws-cdk-lib/aws-s3";
import { Function as Lambda } from "aws-cdk-lib/aws-lambda";
import { Queue } from "aws-cdk-lib/aws-sqs";

export type QuestAssets = {
  sftpActionLambda: Lambda;
  sendPatientRequestLambda: Lambda;
  sendPatientRequestQueue: Queue;
  sendBatchRequestLambda: Lambda;
  sendBatchRequestQueue: Queue;
  receiveResponseLambda: Lambda;
  receiveResponseQueue: Queue;
  convertPatientResponseLambda: Lambda;
  convertBatchResponseLambda: Lambda;
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
