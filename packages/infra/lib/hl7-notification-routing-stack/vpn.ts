import * as cdk from "aws-cdk-lib";
import * as ec2 from "aws-cdk-lib/aws-ec2";
import { Construct } from "constructs";
import { Hl7NotificationRoutingVpnConfig } from "../../config/hl7-notification-routing-config";

const IPSEC_1 = "ipsec.1";

export interface VpnStackProps extends cdk.NestedStackProps {
  vpc: ec2.IVpc;
  vpnConfig: Hl7NotificationRoutingVpnConfig;
}

export class VpnStack extends cdk.NestedStack {
  constructor(scope: Construct, id: string, props: VpnStackProps) {
    super(scope, id, props);

    // 1. Create a Virtual Private Gateway (VGW)
    const vpnGateway = new ec2.CfnVPNGateway(this, "VpnGateway", {
      type: IPSEC_1,
      amazonSideAsn: 65000, // or remove to let AWS pick a default
    });

    // Attach the VGW to your VPC
    new ec2.CfnVPCGatewayAttachment(this, "VpcVpnAttachment", {
      vpcId: props.vpc.vpcId,
      vpnGatewayId: vpnGateway.ref,
    });

    // 2. Create a Customer Gateway
    const customerGateway = new ec2.CfnCustomerGateway(this, "CustomerGateway", {
      bgpAsn: props.vpnConfig.bgpAsn,
      ipAddress: props.vpnConfig.partnerGatewayPublicIp,
      type: IPSEC_1,
    });

    // 3. Create the VPN Connection
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

    // 4. (Optional) Add a static route for your VPC CIDR
    if (props.vpnConfig.staticRoutesOnly) {
      new ec2.CfnVPNConnectionRoute(this, "VpnConnectionRoute", {
        destinationCidrBlock: props.vpc.vpcCidrBlock,
        vpnConnectionId: vpnConnection.ref,
      });
    }

    // Output the connection ID
    new cdk.CfnOutput(this, "VpnConnectionId", {
      value: vpnConnection.ref,
      description: `VPN Connection for ${props.vpnConfig.partnerName}`,
    });
  }
}
