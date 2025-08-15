import { Bucket } from "aws-cdk-lib/aws-s3";
import { Function as Lambda } from "aws-cdk-lib/aws-lambda";
import { Queue } from "aws-cdk-lib/aws-sqs";

export type QuestAssets = {
  sftpActionLambda: Lambda;
  rosterUploadLambda: Lambda;
  responseDownloadLambda: Lambda;
  questFhirConverterLambda: Lambda;
  questFhirConverterQueue: Queue;
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
