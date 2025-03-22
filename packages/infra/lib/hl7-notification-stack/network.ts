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
          value: `${props.config.environmentType}-vgw-1`,
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

    const vpnAccessibleSubnets = vpc.selectSubnets({
      subnetGroupName: VPN_ACCESSIBLE_SUBNET_GROUP_NAME,
    }).subnets;

    // Enable route propagation for each of our private subnets back out to the vgw
    vpnAccessibleSubnets.forEach((subnet, index) => {
      const routePropagation = new ec2.CfnVPNGatewayRoutePropagation(
        this,
        `RouteTablePropagation${index}`,
        {
          routeTableIds: [subnet.routeTable.routeTableId],
          vpnGatewayId: vgw1.attrVpnGatewayId,
        }
      );

      /**
       * Read more about needing to set this dependency here:
       * https://docs.aws.amazon.com/cdk/api/v2/python/aws_cdk.aws_ec2/CfnVPNGatewayRoutePropagation.html
       * */
      routePropagation.node.addDependency(vgw1Attachment);
    });

    // Add routing rules for each partner HIE to route traffic back out thru the VPN to them
    props.config.hl7Notification.vpnConfigs.forEach(config => {
      vpnAccessibleSubnets.forEach((subnet, index) => {
        const route = new ec2.CfnRoute(this, `${config.partnerName}VpnRoute${index}`, {
          routeTableId: subnet.routeTable.routeTableId,
          destinationCidrBlock: config.partnerInternalCidrBlock,
          gatewayId: vgw1.attrVpnGatewayId,
        });

        route.node.addDependency(vgw1Attachment);
      });
    });

    this.output = {
      vgw1,
    };
  }
}
