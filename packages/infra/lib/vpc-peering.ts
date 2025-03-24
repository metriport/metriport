import * as cdk from "aws-cdk-lib";
import * as ec2 from "aws-cdk-lib/aws-ec2";
import { Construct } from "constructs";

interface VpcConfig {
  vpc: ec2.Vpc;
  identifier: string; // Human readable identifier for the VPC
  subnets?: ec2.ISubnet[];
}

interface VpcPeeringStackProps extends cdk.StackProps {
  vpcConfigs: [VpcConfig, VpcConfig];
}

export class VpcPeeringStack extends cdk.Stack {
  readonly peeringConnection: ec2.CfnVPCPeeringConnection;

  constructor(scope: Construct, id: string, props: VpcPeeringStackProps) {
    super(scope, id, props);

    const [vpcConfigA, vpcConfigB] = props.vpcConfigs;

    // Create the VPC Peering Connection with readable name
    this.peeringConnection = new ec2.CfnVPCPeeringConnection(this, "VpcPeering", {
      vpcId: vpcConfigA.vpc.vpcId,
      peerVpcId: vpcConfigB.vpc.vpcId,
      tags: [
        {
          key: "Name",
          value: `${vpcConfigA.identifier}-to-${vpcConfigB.identifier}-peering`,
        },
      ],
    });

    // Create routes for both VPCs using readable identifiers
    this.createRoutesForVpc(vpcConfigA, vpcConfigB);
    this.createRoutesForVpc(vpcConfigB, vpcConfigA);
  }

  private createRoutesForVpc(sourceConfig: VpcConfig, destinationConfig: VpcConfig): void {
    const subnets = sourceConfig.subnets ?? sourceConfig.vpc.privateSubnets;
    subnets.forEach((subnet, i) => {
      new ec2.CfnRoute(
        this,
        `Route${sourceConfig.identifier}To${destinationConfig.identifier}${i}`,
        {
          routeTableId: subnet.routeTable.routeTableId,
          destinationCidrBlock: destinationConfig.vpc.vpcCidrBlock,
          vpcPeeringConnectionId: this.peeringConnection.ref,
        }
      );
    });
  }
}
