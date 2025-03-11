import * as cdk from "aws-cdk-lib";
import * as ec2 from "aws-cdk-lib/aws-ec2";
import { Construct } from "constructs";
import { Hl7NotificationVpnConfig } from "../../config/hl7-notification-config";

const IPSEC_1 = "ipsec.1";

export interface VpnStackProps extends cdk.NestedStackProps {
  vpc: ec2.IVpc;
  vpnConfig: Hl7NotificationVpnConfig;
}

/**
 * This stack creates all the infra to setup a VPN tunnel with an HIE sending us HL7 messages.
 * @see https://docs.aws.amazon.com/vpn/latest/s2svpn/VPC_VPN.html
 */
export class VpnStack extends cdk.NestedStack {
  constructor(scope: Construct, id: string, props: VpnStackProps) {
    super(scope, id, props);

    const vpnGateway = new ec2.CfnVPNGateway(this, `${props.vpnConfig.partnerName}VpnGateway`, {
      type: IPSEC_1,
    });

    // Attach the VGW to your VPC
    new ec2.CfnVPCGatewayAttachment(this, `${props.vpnConfig.partnerName}VpcVpnAttachment`, {
      vpcId: props.vpc.vpcId,
      vpnGatewayId: vpnGateway.ref,
    });

    const customerGateway = new ec2.CfnCustomerGateway(
      this,
      `${props.vpnConfig.partnerName}CustomerGateway`,
      {
        ipAddress: props.vpnConfig.partnerGatewayPublicIp,
        type: IPSEC_1,
        // Not using bgpAsn but "Invalid request provided: The key 'BgpAsn' is required"
        bgpAsn: 65000,
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
        vpnGatewayId: vpnGateway.ref,
        customerGatewayId: customerGateway.ref,
        staticRoutesOnly: props.vpnConfig.staticRoutesOnly,
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

    if (props.vpnConfig.staticRoutesOnly) {
      new ec2.CfnVPNConnectionRoute(this, `${props.vpnConfig.partnerName}VpnConnectionRoute`, {
        destinationCidrBlock: props.vpc.vpcCidrBlock,
        vpnConnectionId: vpnConnection.ref,
      });
    }

    new cdk.CfnOutput(this, `${props.vpnConfig.partnerName}VpnConnectionId`, {
      value: vpnConnection.ref,
      description: `VPN Connection for ${props.vpnConfig.partnerName}`,
    });
  }
}
