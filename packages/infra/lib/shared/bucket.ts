import { CfnOutput, Duration } from "aws-cdk-lib";
import * as s3 from "aws-cdk-lib/aws-s3";
import { Construct } from "constructs";

type Require<T, K extends keyof T> = T & { [P in K]-?: T[P] };

/**
 * Intelligent Tiering lifecycle rule for S3 buckets.
 */
export const INTELLIGENT_TIERING = {
  lifecycleRules: [
    {
      id: "MoveToIntelligentTiering",
      enabled: true,
      transitions: [
        {
          storageClass: s3.StorageClass.INTELLIGENT_TIERING,
          transitionAfter: Duration.days(0),
        },
      ],
    },
  ],
};

export function createBucket(
  scope: Construct,
  props: Require<s3.BucketProps, "bucketName">,
  bucketId?: string
): s3.Bucket {
  const id = bucketId ?? props.bucketName;
  const bucket = new s3.Bucket(scope, id, {
    publicReadAccess: false,
    encryption: s3.BucketEncryption.S3_MANAGED,
    ...INTELLIGENT_TIERING,
    ...props,
  });

  new CfnOutput(scope, `${props.bucketName}-BucketName`, {
    value: bucket.bucketName,
    description: "Name of the bucket",
  });

  return bucket;
}
