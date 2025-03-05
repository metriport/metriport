import * as cdk from "aws-cdk-lib";
import * as ec2 from "aws-cdk-lib/aws-ec2";
import { Construct } from "constructs";
import { Hl7NotificationRoutingVpnConfig } from "../../config/hl7-notification-routing-config";

const IPSEC_1 = "ipsec.1";

export interface VpnStackProps extends cdk.NestedStackProps {
  vpc: ec2.IVpc;
  vpnConfig: Hl7NotificationRoutingVpnConfig;
}

/**
 * This stack creates all the infra to setup a VPN tunnel with an HIE sending us HL7 messages.
 * @see https://docs.aws.amazon.com/vpn/latest/s2svpn/VPC_VPN.html
 */
export class VpnStack extends cdk.NestedStack {
  constructor(scope: Construct, id: string, props: VpnStackProps) {
    super(scope, id, props);

    const vpnGateway = new ec2.CfnVPNGateway(this, "VpnGateway", {
      type: IPSEC_1,
    });

    // Attach the VGW to your VPC
    new ec2.CfnVPCGatewayAttachment(this, "VpcVpnAttachment", {
      vpcId: props.vpc.vpcId,
      vpnGatewayId: vpnGateway.ref,
    });

    const customerGateway = new ec2.CfnCustomerGateway(this, "CustomerGateway", {
      ipAddress: props.vpnConfig.partnerGatewayPublicIp,
      type: IPSEC_1,
      // Not using bgpAsn but "Invalid request provided: The key 'BgpAsn' is required"
      bgpAsn: 65000,
    });

    /**
     * We use 2 tunnels here because state HIEs often have a failover to a backup IP..
     */
    const vpnConnection = new ec2.CfnVPNConnection(this, "VpnConnection", {
      type: IPSEC_1,
      vpnGatewayId: vpnGateway.ref,
      customerGatewayId: customerGateway.ref,
      staticRoutesOnly: props.vpnConfig.staticRoutesOnly,
      vpnTunnelOptionsSpecifications: [
        {
          preSharedKey: props.vpnConfig.preSharedKeyTunnel1,
          ikeVersions: [{ value: "ikev2" }],
          phase1LifetimeSeconds: props.vpnConfig.phase1LifetimeSeconds,
          phase2LifetimeSeconds: props.vpnConfig.phase2LifetimeSeconds,
        },
        {
          preSharedKey: props.vpnConfig.preSharedKeyTunnel2,
          ikeVersions: [{ value: "ikev2" }],
          phase1LifetimeSeconds: props.vpnConfig.phase1LifetimeSeconds,
          phase2LifetimeSeconds: props.vpnConfig.phase2LifetimeSeconds,
        },
      ],
    });

    if (props.vpnConfig.staticRoutesOnly) {
      new ec2.CfnVPNConnectionRoute(this, "VpnConnectionRoute", {
        destinationCidrBlock: props.vpc.vpcCidrBlock,
        vpnConnectionId: vpnConnection.ref,
      });
    }

    new cdk.CfnOutput(this, "VpnConnectionId", {
      value: vpnConnection.ref,
      description: `VPN Connection for ${props.vpnConfig.partnerName}`,
    });
  }
}
