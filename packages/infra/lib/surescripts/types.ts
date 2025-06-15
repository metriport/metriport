import { Bucket } from "aws-cdk-lib/aws-s3";
import { Function as Lambda } from "aws-cdk-lib/aws-lambda";
import { Queue } from "aws-cdk-lib/aws-sqs";

export type SurescriptsAssets = {
  sftpActionLambda: Lambda;
  sendPatientRequestLambda: Lambda;
  sendPatientRequestQueue: Queue;
  sendBatchRequestLambda: Lambda;
  sendBatchRequestQueue: Queue;
  verifyRequestInHistoryLambda: Lambda;
  verifyRequestInHistoryQueue: Queue;
  receiveVerificationLambda: Lambda;
  receiveVerificationQueue: Queue;
  receiveResponseLambda: Lambda;
  receiveResponseQueue: Queue;
  convertPatientResponseLambda: Lambda;
  convertBatchResponseLambda: Lambda;
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
