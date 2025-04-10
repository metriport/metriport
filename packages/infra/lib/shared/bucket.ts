import { CfnOutput, Stack } from "aws-cdk-lib";
import * as s3 from "aws-cdk-lib/aws-s3";

type Require<T, K extends keyof T> = T & { [P in K]-?: T[P] };

export function createBucket(
  stack: Stack,
  props: Require<s3.BucketProps, "bucketName">
): s3.Bucket {
  const bucket = new s3.Bucket(stack, props.bucketName, {
    publicReadAccess: false,
    encryption: s3.BucketEncryption.S3_MANAGED,
    ...props,
  });

  new CfnOutput(stack, `${props.bucketName}-BucketName`, {
    value: bucket.bucketName,
    description: "Name of the bucket",
  });

  return bucket;
}
