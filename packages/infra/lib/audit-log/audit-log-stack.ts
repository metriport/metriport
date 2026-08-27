import { Stack, StackProps } from "aws-cdk-lib";
import * as s3 from "aws-cdk-lib/aws-s3";
import { Construct } from "constructs";
import { EnvConfig } from "../../config/env-config";
import { createBucket } from "../shared/bucket";

interface AuditLogStackProps extends StackProps {
  config: EnvConfig;
}

export class AuditLogStack extends Stack {
  public readonly auditLogBucket: s3.Bucket;

  constructor(scope: Construct, id: string, props: AuditLogStackProps) {
    super(scope, id, props);

    this.terminationProtection = true;

    this.auditLogBucket = createBucket(this, {
      bucketName: props.config.auditLogs.bucketName,
    });
  }
}
