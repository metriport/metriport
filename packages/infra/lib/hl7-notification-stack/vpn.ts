import * as cdk from "aws-cdk-lib";
import * as ec2 from "aws-cdk-lib/aws-ec2";
import { Construct } from "constructs";
import { Hl7NotificationVpnConfig } from "../../config/hl7-notification-config";
import { NetworkStackOutput } from "./network";
import { MllpStackOutput } from "./mllp";
import { VPN_ACCESSIBLE_SUBNET_GROUP_NAME } from "./constants";

const IPSEC_1 = "ipsec.1";

export interface VpnStackProps extends cdk.NestedStackProps {
  vpc: ec2.Vpc;
  vpnConfig: Hl7NotificationVpnConfig;
  networkStack: NetworkStackOutput;
  mllpStack: MllpStackOutput;
}

/**
 * This stack creates all the infra to setup a VPN tunnel with an HIE sending us HL7 messages.
 * @see https://docs.aws.amazon.com/vpn/latest/s2svpn/VPC_VPN.html
 */
export class VpnStack extends cdk.NestedStack {
  constructor(scope: Construct, id: string, props: VpnStackProps) {
    super(scope, id, props);

    const customerGateway = new ec2.CfnCustomerGateway(
      this,
      `${props.vpnConfig.partnerName}CustomerGateway`,
      {
        ipAddress: props.vpnConfig.partnerGatewayPublicIp,
        type: IPSEC_1,
        bgpAsn: 65000,
        tags: [
          {
            key: "Name",
            value: `${props.vpnConfig.partnerName}-cgw`,
          },
        ],
      }
    );

    /**
     * We use 2 tunnels here because state HIEs often have a failover to a backup IP..
     */
    const vpnConnection = new ec2.CfnVPNConnection(
      this,
      `${props.vpnConfig.partnerName}VpnConnection`,
      {
        type: IPSEC_1,
        vpnGatewayId: props.networkStack.vgw1.ref,
        customerGatewayId: customerGateway.ref,
        staticRoutesOnly: props.vpnConfig.staticRoutesOnly,
        tags: [
          {
            key: "Name",
            value: `${props.vpnConfig.partnerName}-vpn`,
          },
        ],
        vpnTunnelOptionsSpecifications: [
          // TODO(lucas|2754|2025-03-05): Replace placeholders with preshared keys loaded from AWS Secrets Manager
          {
            preSharedKey: "PRESHARED_KEY_PLACEHOLDER",
          },
          {
            preSharedKey: "PRESHARED_KEY_PLACEHOLDER",
          },
        ],
      }
    );

    const vpnAccessibleSubnets = props.vpc.selectSubnets({
      subnetGroupName: VPN_ACCESSIBLE_SUBNET_GROUP_NAME,
    }).subnets;

    if (props.vpnConfig.staticRoutesOnly) {
      vpnAccessibleSubnets.forEach((subnet, index) => {
        new ec2.CfnVPNConnectionRoute(
          this,
          `${props.vpnConfig.partnerName}-MetriportSideVpnConnectionRoute${index}`,
          {
            destinationCidrBlock: subnet.ipv4CidrBlock,
            vpnConnectionId: vpnConnection.ref,
          }
        );
      });

      new ec2.CfnVPNConnectionRoute(
        this,
        `${props.vpnConfig.partnerName}-HieSideVpnConnectionRoute`,
        {
          destinationCidrBlock: props.vpnConfig.partnerInternalCidrBlock,
          vpnConnectionId: vpnConnection.ref,
        }
      );
    }

    new cdk.CfnOutput(this, `${props.vpnConfig.partnerName}VpnConnectionId`, {
      value: vpnConnection.ref,
      description: `VPN Connection for ${props.vpnConfig.partnerName}`,
    });
  }
}
