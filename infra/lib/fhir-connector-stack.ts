import { Stack, StackProps } from "aws-cdk-lib";
import { SnsAction } from "aws-cdk-lib/aws-cloudwatch-actions";
import { Bucket, IBucket } from "aws-cdk-lib/aws-s3";
import { Queue } from "aws-cdk-lib/aws-sqs";
import { Construct } from "constructs";
import * as fhirConverterConnector from "./creators/fhir-converter-connector";
import * as fhirServerConnector from "./creators/fhir-server-connector";
import * as sidechainFHIRConverterConnector from "./creators/sidechain-fhir-converter-connector";
import { EnvConfig } from "./env-config";
import { QueueGroup, QueueGroupARNs } from "./lambdas-types";

interface FHIRConnectorStackProps extends StackProps {
  config: EnvConfig;
  alarmAction?: SnsAction | undefined;
}

export type FHIRConnector = QueueGroup & {
  bucket: IBucket;
};

export type FHIRConnectorARNs = QueueGroupARNs & {
  bucketArn: string;
};

export class FHIRConnectorStack extends Stack {
  private _fhirConverterConnector: FHIRConnector;
  private _sidechainFHIRConverterConnector: FHIRConnector;
  private _fhirServerConnector: FHIRConnector;

  constructor(scope: Construct, id: string, props: FHIRConnectorStackProps) {
    super(scope, id, {
      ...props,
      stackName: id,
    });

    this._fhirConverterConnector = fhirConverterConnector.createQueueAndBucket({
      stack: this,
      alarmSnsAction: props.alarmAction,
    });

    this._sidechainFHIRConverterConnector = sidechainFHIRConverterConnector.createQueueAndBucket({
      stack: this,
      alarmSnsAction: props.alarmAction,
    });

    this._fhirServerConnector = fhirServerConnector.createQueueAndBucket({
      stack: this,
      alarmSnsAction: props.alarmAction,
      fhirConverterBucket: this._sidechainFHIRConverterConnector.bucket,
      sandboxSeedDataBucketName: props.config.sandboxSeedDataBucketName,
    });
  }

  get fhirConverterConnector(): FHIRConnector {
    return this._fhirConverterConnector;
  }
  get sidechainFHIRConverterConnector(): FHIRConnector {
    return this._sidechainFHIRConverterConnector;
  }
  get fhirServerConnector(): FHIRConnector {
    return this._fhirServerConnector;
  }

  static toARNs(connector: FHIRConnector): FHIRConnectorARNs {
    return {
      queueArn: connector.queue.queueArn,
      dlqArn: connector.dlq.queueArn,
      bucketArn: connector.bucket.bucketArn,
      createRetryLambda: connector.createRetryLambda,
    };
  }
  static fromARNs(stack: Construct, connector: FHIRConnectorARNs & { id: string }): FHIRConnector {
    const queue = Queue.fromQueueArn(stack, connector.id + "Queue", connector.queueArn);
    const dlq = Queue.fromQueueArn(stack, connector.id + "DLQ", connector.dlqArn);
    const bucket = Bucket.fromBucketArn(stack, connector.id + "Bucket", connector.bucketArn);
    return { queue, dlq, bucket };
  }
}
