import { Stack, StackProps } from "aws-cdk-lib";
import { SnsAction } from "aws-cdk-lib/aws-cloudwatch-actions";
import * as s3 from "aws-cdk-lib/aws-s3";
import { DeadLetterQueue, Queue } from "aws-cdk-lib/aws-sqs";
import { Construct } from "constructs";
import * as fhirConverterConnector from "./creators/fhir-converter-connector";
import * as sidechainFHIRConverterConnector from "./creators/sidechain-fhir-converter-connector";
import { EnvConfig } from "./env-config";

interface FHIRConnectorStackProps extends StackProps {
  config: EnvConfig;
  alarmAction: SnsAction | undefined;
}

export type FHIRConnector = {
  queue: Queue;
  dlq: DeadLetterQueue;
  bucket: s3.Bucket;
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
}
