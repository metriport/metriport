import { NestedStack, NestedStackProps } from "aws-cdk-lib";
import * as ecr from "aws-cdk-lib/aws-ecr";
import * as s3 from "aws-cdk-lib/aws-s3";
import { Construct } from "constructs";
import { EnvConfigNonSandbox } from "../../config/env-config";

interface AnalyticsPlatformsNestedStackProps extends NestedStackProps {
  config: EnvConfigNonSandbox;
}

export class AnalyticsPlatformsNestedStack extends NestedStack {
  constructor(scope: Construct, id: string, props: AnalyticsPlatformsNestedStackProps) {
    super(scope, id, props);

    this.terminationProtection = true;

    new s3.Bucket(this, "AnalyticsPlatformBucket", {
      bucketName: props.config.analyticsPlatform.bucketName,
      publicReadAccess: false,
      encryption: s3.BucketEncryption.S3_MANAGED,
      versioned: true,
    });

    new ecr.Repository(this, "AnalyticsPlatformRepository", {
      repositoryName: "metriport/analytics-platform",
    });
  }
}
