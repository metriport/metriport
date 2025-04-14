import { Stack, StackProps } from "aws-cdk-lib";
import * as s3 from "aws-cdk-lib/aws-s3";
import { Construct } from "constructs";
import { EnvConfig } from "../config/env-config";
import { isSandbox } from "../lib/shared/util";
import { createBucket } from "./shared/bucket";

interface BucketsStackProps extends StackProps {
  config: EnvConfig;
}

export class BucketsStack extends Stack {
  public readonly incomingHl7NotificationBucket?: s3.Bucket;
  public readonly outgoingHl7NotificationBucket?: s3.Bucket;

  constructor(scope: Construct, id: string, props: BucketsStackProps) {
    super(scope, id, props);

    this.terminationProtection = true;

    if (!isSandbox(props.config)) {
      this.incomingHl7NotificationBucket = createBucket(this, {
        bucketName: props.config.hl7Notification.incomingMessageBucketName,
      });
      this.outgoingHl7NotificationBucket = createBucket(this, {
        bucketName: props.config.hl7Notification.outgoingMessageBucketName,
      });
    }
  }
}
