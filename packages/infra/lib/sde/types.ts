import { Function as Lambda } from "aws-cdk-lib/aws-lambda";

export interface SDEAssets {
  extractDocumentLambda: Lambda;
  structuredDataBucket: s3.Bucket;
  sdeLambdas: {
    envVarName: string;
    lambda: Lambda;
  }[];
}
