import { Stack, StackProps } from "aws-cdk-lib";
import { SnsAction } from "aws-cdk-lib/aws-cloudwatch-actions";
import { Bucket, IBucket } from "aws-cdk-lib/aws-s3";
import { IQueue, Queue } from "aws-cdk-lib/aws-sqs";
import { Construct } from "constructs";
import * as fhirConverterConnector from "./creators/fhir-converter-connector";
import * as sidechainFHIRConverterConnector from "./creators/sidechain-fhir-converter-connector";
import { EnvConfig } from "./env-config";

interface FHIRConnectorStackProps extends StackProps {
  config: EnvConfig;
  alarmAction?: SnsAction | undefined;
}

export type FHIRConnector = {
  queue: IQueue;
  dlq: IQueue;
  bucket: IBucket;
};

export type FHIRConnectorARNs = {
  queueArn: string;
  dlqArn: string;
  bucketArn: string;
};

export class FHIRConnectorStack extends Stack {
  private _fhirConnector: FHIRConnector;
  private _sidechainFHIRConnector: FHIRConnector;

  constructor(scope: Construct, id: string, props: FHIRConnectorStackProps) {
    super(scope, id, {
      ...props,
      stackName: id,
    });

    this._fhirConnector = fhirConverterConnector.createQueueAndBucket({
      stack: this,
      alarmSnsAction: props.alarmAction,
    });

    this._sidechainFHIRConnector = sidechainFHIRConverterConnector.createQueueAndBucket({
      stack: this,
      alarmSnsAction: props.alarmAction,
    });
  }

  get fhirConnector(): FHIRConnector {
    return this._fhirConnector;
  }
  get sidechainFHIRConnector(): FHIRConnector {
    return this._sidechainFHIRConnector;
  }

  static toARNs(connector: FHIRConnector): FHIRConnectorARNs {
    return {
      queueArn: connector.queue.queueArn,
      dlqArn: connector.dlq.queueArn,
      bucketArn: connector.bucket.bucketArn,
    };
  }
  static fromARNs(stack: Construct, connector: FHIRConnectorARNs & { id: string }): FHIRConnector {
    const queue = Queue.fromQueueArn(stack, connector.id + "Queue", connector.queueArn);
    const dlq = Queue.fromQueueArn(stack, connector.id + "DLQ", connector.dlqArn);
    const bucket = Bucket.fromBucketArn(stack, connector.id + "Bucket", connector.bucketArn);
    return { queue, dlq, bucket };
  }
}
