import { Bucket } from "aws-cdk-lib/aws-s3";
import { Function as Lambda } from "aws-cdk-lib/aws-lambda";
import { Queue } from "aws-cdk-lib/aws-sqs";

export type QuestAssets = {
  sftpActionLambda: Lambda;
  sftpActionQueue: Queue;
  sendRequestLambda: Lambda;
  sendRequestQueue: Queue;
  receiveResponseLambda: Lambda;
  receiveResponseQueue: Queue;
  questReplicaBucket: Bucket;
  labConversionBucket: Bucket;
};
