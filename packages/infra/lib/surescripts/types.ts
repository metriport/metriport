import { Bucket } from "aws-cdk-lib/aws-s3";
import { Function as Lambda } from "aws-cdk-lib/aws-lambda";
import { Queue } from "aws-cdk-lib/aws-sqs";

export type SurescriptsAssets = {
  synchronizeSftpLambda: Lambda;
  synchronizeSftpQueue: Queue;
  sendPatientRequestLambda: Lambda;
  sendPatientRequestQueue: Queue;
  receiveVerificationResponseLambda: Lambda;
  receiveVerificationResponseQueue: Queue;
  receiveFlatFileResponseLambda: Lambda;
  receiveFlatFileResponseQueue: Queue;
  surescriptsReplicaBucket: Bucket;
  medicationBundleBucket: Bucket;
};
