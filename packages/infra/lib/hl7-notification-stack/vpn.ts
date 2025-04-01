import * as cdk from "aws-cdk-lib";
import { Fn } from "aws-cdk-lib";
import * as ec2 from "aws-cdk-lib/aws-ec2";
import * as secret from "aws-cdk-lib/aws-secretsmanager";
import { Construct } from "constructs";
import { Hl7NotificationVpnConfig } from "../../config/hl7-notification-config";
import { MLLP_DEFAULT_PORT } from "./constants";

const IPSEC_1 = "ipsec.1";
const PROBLEMATIC_IPSEC_CHARACTERS = "!@#$%^&*()_+-=[]{}|;:,.<>?";

export interface VpnStackProps extends cdk.NestedStackProps {
  vpnConfig: Hl7NotificationVpnConfig;
  networkStackId: string;
  index: number;
}

/**
 * This stack creates all the infra to setup a VPN tunnel with an HIE sending us HL7 messages.
 * @see https://docs.aws.amazon.com/vpn/latest/s2svpn/VPC_VPN.html
 */
export class VpnStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props: VpnStackProps) {
    super(scope, id, props);

    const { partnerName, partnerInternalCidrBlock } = props.vpnConfig;

    const networkAcl = ec2.NetworkAcl.fromNetworkAclId(
      this,
      `NetworkAcl-${partnerName}`,
      Fn.importValue(`${props.networkStackId}-NetworkAclId`)
    );

    const vgwId = Fn.importValue(`${props.networkStackId}-VgwId`);

    const customerGateway = new ec2.CfnCustomerGateway(this, `CustomerGateway-${partnerName}`, {
      ipAddress: props.vpnConfig.partnerGatewayPublicIp,
      type: IPSEC_1,
      bgpAsn: 65000,
      tags: [
        {
          key: "Name",
          value: `${partnerName}-cgw`,
        },
      ],
    });

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

    const createPskSecret = (index: number) => {
      return new secret.Secret(this, `PresharedKey${index}-${partnerName}`, {
        secretName: `PresharedKey${index}-${partnerName}`,
        generateSecretString: {
          excludePunctuation: true,
          excludeCharacters: PROBLEMATIC_IPSEC_CHARACTERS,
        },
      });
    };

    const presharedKey1 = createPskSecret(1);
    const presharedKey2 = createPskSecret(2);
    /**
     * We use 2 tunnels here because state HIEs often have a failover to a backup IP..
     */
    const vpnConnection = new ec2.CfnVPNConnection(this, `VpnConnection-${partnerName}`, {
      type: IPSEC_1,
      vpnGatewayId: vgwId,
      customerGatewayId: customerGateway.ref,
      staticRoutesOnly: true,
      tags: [
        {
          key: "Name",
          value: `${partnerName}-vpn`,
        },
      ],
      vpnTunnelOptionsSpecifications: [
        {
          preSharedKey: Fn.sub("{{resolve:secretsmanager:${SecretArn}:SecretString}}", {
            SecretArn: presharedKey1.secretArn,
          }),
        },
        {
          preSharedKey: Fn.sub("{{resolve:secretsmanager:${SecretArn}:SecretString}}", {
            SecretArn: presharedKey2.secretArn,
          }),
        },
      ],
    });

    new ec2.CfnVPNConnectionRoute(this, `VpnConnectionRoute-${partnerName}`, {
      destinationCidrBlock: props.vpnConfig.partnerInternalCidrBlock,
      vpnConnectionId: vpnConnection.ref,
    });

    new cdk.CfnOutput(this, `VpnConnectionId-${partnerName}`, {
      value: vpnConnection.ref,
      description: `VPN Connection for ${partnerName}`,
    });
  }

  private setNaclRules(
    networkAcl: ec2.INetworkAcl,
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
    networkAcl: ec2.INetworkAcl,
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
    networkAcl: ec2.INetworkAcl,
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
