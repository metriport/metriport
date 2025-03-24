import * as cdk from "aws-cdk-lib";
import * as ec2 from "aws-cdk-lib/aws-ec2";
import { Construct } from "constructs";
import { EnvConfigNonSandbox } from "../../config/env-config";
import { VPN_ACCESSIBLE_SUBNET_GROUP_NAME } from "./constants";

const IPSEC_1 = "ipsec.1";

interface NetworkStackProps extends cdk.StackProps {
  vpc: ec2.Vpc;
  config: EnvConfigNonSandbox;
}

export interface NetworkStackOutput {
  vgw1: ec2.CfnVPNGateway;
  networkAcl: ec2.NetworkAcl;
}

export class NetworkStack extends cdk.NestedStack {
  public readonly output: NetworkStackOutput;

  constructor(scope: Construct, id: string, props: NetworkStackProps) {
    super(scope, id, props);

    const { vpc } = props;

    const vgw1 = new ec2.CfnVPNGateway(this, `VirtualPrivateGateway1`, {
      type: IPSEC_1,
      tags: [
        {
          key: "Name",
          value: "vgw-1",
        },
      ],
    });

    const vgw1Attachment = new ec2.CfnVPCGatewayAttachment(
      this,
      `VirtualPrivateGateway1VpcVpnAttachment`,
      {
        vpcId: vpc.vpcId,
        vpnGatewayId: vgw1.ref,
      }
    );

    const networkAcl = new ec2.NetworkAcl(this, "VpnAccessibleMllpServerNacl", {
      vpc,
      subnetSelection: { subnetGroupName: VPN_ACCESSIBLE_SUBNET_GROUP_NAME },
    });

    // Ephemeral ports to allow for TCP handshakes with ECR
    networkAcl.addEntry("AllowEphemeralPortsIngress", {
      ruleNumber: 5000,
      direction: ec2.TrafficDirection.INGRESS,
      traffic: ec2.AclTraffic.tcpPortRange(32768, 65535),
      ruleAction: ec2.Action.ALLOW,
      cidr: ec2.AclCidr.ipv4("0.0.0.0/0"),
    });

    // Used by fargate to pull images from ECR
    networkAcl.addEntry("AllowHttpsEgress", {
      ruleNumber: 5000,
      direction: ec2.TrafficDirection.EGRESS,
      traffic: ec2.AclTraffic.tcpPort(443),
      ruleAction: ec2.Action.ALLOW,
      cidr: ec2.AclCidr.ipv4("0.0.0.0/0"),
    });

    /**
     * Read more about needing to set the dependency here:
     * https://docs.aws.amazon.com/cdk/api/v2/python/aws_cdk.aws_ec2/CfnVPNGatewayRoutePropagation.html
     * */

    // Enable route propagation for each of our private subnets back out to the vgw
    vpc.privateSubnets.forEach((subnet, index) => {
      const routePropagation = new ec2.CfnVPNGatewayRoutePropagation(
        this,
        `RouteTablePropagation${index}`,
        {
          routeTableIds: [subnet.routeTable.routeTableId],
          vpnGatewayId: vgw1.attrVpnGatewayId,
        }
      );

      routePropagation.node.addDependency(vgw1Attachment);
    });

    this.output = {
      vgw1,
      networkAcl,
    };
  }
}
