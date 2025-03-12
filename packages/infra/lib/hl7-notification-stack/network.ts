import * as cdk from "aws-cdk-lib";
import * as ec2 from "aws-cdk-lib/aws-ec2";
import { Construct } from "constructs";
import { EnvConfig } from "../../config/env-config";

const NUM_AZS = 2;

interface NetworkStackProps extends cdk.StackProps {
  config: EnvConfig;
}

export interface NetworkStackOutput {
  vpc: ec2.Vpc;
}

export class NetworkStack extends cdk.NestedStack {
  public readonly output: NetworkStackOutput;

  constructor(scope: Construct, id: string, props: NetworkStackProps) {
    super(scope, id, props);

    const vpc = new ec2.Vpc(this, "Vpc", {
      maxAzs: NUM_AZS,
      natGateways: NUM_AZS,
      ipAddresses: ec2.IpAddresses.cidr("10.1.0.0/16"),
    });

    this.output = {
      vpc,
    };
  }
}
