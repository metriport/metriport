import { Function as Lambda } from "aws-cdk-lib/aws-lambda";
import { Bucket } from "aws-cdk-lib/aws-s3";

export interface SDEAssets {
  extractDocumentLambda: Lambda;
  structuredDataBucket: Bucket;
  sdeLambdas: {
    envVarName: string;
    lambda: Lambda;
  }[];
}
