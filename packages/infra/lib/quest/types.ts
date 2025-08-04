import { Bucket } from "aws-cdk-lib/aws-s3";
import { Function as Lambda } from "aws-cdk-lib/aws-lambda";

export type QuestAssets = {
  sftpActionLambda: Lambda;
  rosterUploadLambda: Lambda;
  responseDownloadLambda: Lambda;
  convertResponseLambda: Lambda;
  questReplicaBucket: Bucket;
  labConversionBucket: Bucket;
  questLambdas: {
    envVarName: string;
    lambda: Lambda;
  }[];
};
