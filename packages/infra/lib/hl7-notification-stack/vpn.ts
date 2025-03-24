import * as cdk from "aws-cdk-lib";
import * as ec2 from "aws-cdk-lib/aws-ec2";
import { Construct } from "constructs";
import { Hl7NotificationVpnConfig } from "../../config/hl7-notification-config";
import { NetworkStackOutput } from "./network";
import { MLLP_DEFAULT_PORT } from "./constants";
import * as secret from "aws-cdk-lib/aws-secretsmanager";
import { Fn } from "aws-cdk-lib";

const IPSEC_1 = "ipsec.1";

export interface VpnStackProps extends cdk.NestedStackProps {
  vpc: ec2.Vpc;
  vpnConfig: Hl7NotificationVpnConfig & {
    presharedKey: secret.ISecret;
  };
  networkStack: NetworkStackOutput;
  index: number;
}

/**
 * This stack creates all the infra to setup a VPN tunnel with an HIE sending us HL7 messages.
 * @see https://docs.aws.amazon.com/vpn/latest/s2svpn/VPC_VPN.html
 */
export class VpnStack extends cdk.NestedStack {
  constructor(scope: Construct, id: string, props: VpnStackProps) {
    super(scope, id, props);

    const { networkAcl } = props.networkStack;
    const { partnerInternalCidrBlock, presharedKey } = props.vpnConfig;

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
     * Add new rules to the NACL for the static IPs we're using for this VPN.
     */
    this.addIngressRules(networkAcl, partnerInternalCidrBlock, [
      {
        ruleNumber: 120 + props.index * 10,
        traffic: ec2.AclTraffic.tcpPort(MLLP_DEFAULT_PORT),
        ruleAction: ec2.Action.ALLOW,
      },
      // Used to create a point on the NACL to deny all traffic, below which we can
      // add other allow rules for other services the subnet members need to access
      {
        ruleNumber: 1400 + props.index * 10,
        traffic: ec2.AclTraffic.allTraffic(),
        ruleAction: ec2.Action.DENY,
      },
    ]);

    this.addEgressRules(networkAcl, partnerInternalCidrBlock, [
      // Outbound TCP handshake traffic
      {
        ruleNumber: 120 + props.index * 10,
        traffic: ec2.AclTraffic.tcpPortRange(1024, 65535),
        ruleAction: ec2.Action.ALLOW,
      },
      {
        ruleNumber: 1400 + props.index * 10,
        traffic: ec2.AclTraffic.allTraffic(),
        ruleAction: ec2.Action.DENY,
      },
    ]);

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
        staticRoutesOnly: true,
        tags: [
          {
            key: "Name",
            value: `${props.vpnConfig.partnerName}-vpn`,
          },
        ],
        vpnTunnelOptionsSpecifications: [
          {
            preSharedKey: Fn.sub(
              "{{resolve:secretsmanager:${SecretArn}:SecretString:presharedKey1}}",
              {
                SecretArn: presharedKey.secretArn,
              }
            ),
          },
          {
            preSharedKey: Fn.sub(
              "{{resolve:secretsmanager:${SecretArn}:SecretString:presharedKey2}}",
              {
                SecretArn: presharedKey.secretArn,
              }
            ),
          },
        ],
      }
    );

    new ec2.CfnVPNConnectionRoute(
      this,
      `${props.vpnConfig.partnerName}-HieSideVpnConnectionRoute`,
      {
        destinationCidrBlock: props.vpnConfig.partnerInternalCidrBlock,
        vpnConnectionId: vpnConnection.ref,
      }
    );

    new cdk.CfnOutput(this, `${props.vpnConfig.partnerName}VpnConnectionId`, {
      value: vpnConnection.ref,
      description: `VPN Connection for ${props.vpnConfig.partnerName}`,
    });
  }

  private setNaclRules(
    networkAcl: ec2.NetworkAcl,
    partnerInternalCidrBlock: string,
    direction: ec2.TrafficDirection,
    rules: {
      ruleNumber: number;
      traffic: ec2.AclTraffic;
      ruleAction: ec2.Action;
    }[]
  ) {
    const cidr = ec2.AclCidr.ipv4(partnerInternalCidrBlock);

    rules.forEach(rule => {
      const ruleName = `${direction === ec2.TrafficDirection.INGRESS ? "Ingress" : "Egress"}Rule${
        rule.ruleNumber
      }`;
      networkAcl.addEntry(ruleName, {
        cidr,
        direction,
        ruleNumber: rule.ruleNumber,
        traffic: rule.traffic,
        ruleAction: rule.ruleAction,
      });
    });
  }

  private addIngressRules(
    networkAcl: ec2.NetworkAcl,
    partnerInternalCidrBlock: string,
    rules: {
      ruleNumber: number;
      traffic: ec2.AclTraffic;
      ruleAction: ec2.Action;
    }[]
  ) {
    this.setNaclRules(networkAcl, partnerInternalCidrBlock, ec2.TrafficDirection.INGRESS, rules);
  }

  private addEgressRules(
    networkAcl: ec2.NetworkAcl,
    partnerInternalCidrBlock: string,
    rules: {
      ruleNumber: number;
      traffic: ec2.AclTraffic;
      ruleAction: ec2.Action;
    }[]
  ) {
    this.setNaclRules(networkAcl, partnerInternalCidrBlock, ec2.TrafficDirection.EGRESS, rules);
  }
}
