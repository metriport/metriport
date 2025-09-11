import * as cdk from "aws-cdk-lib";
import { Fn } from "aws-cdk-lib";
import * as ec2 from "aws-cdk-lib/aws-ec2";
import * as secret from "aws-cdk-lib/aws-secretsmanager";
import { Construct } from "constructs";
import { MLLP_DEFAULT_PORT } from "./constants";
import { HieConfig } from "@metriport/core/command/hl7v2-subscriptions/types";

const IPSEC_1 = "ipsec.1";

export interface VpnStackProps extends cdk.NestedStackProps {
  hieConfig: HieConfig;
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

    const { name: hieName, internalCidrBlocks, gatewayPublicIp } = props.hieConfig;

    const networkAcl = ec2.NetworkAcl.fromNetworkAclId(
      this,
      `NetworkAcl-${hieName}`,
      Fn.importValue(`${props.networkStackId}-NetworkAclId`)
    );

    const vgwId = Fn.importValue(`${props.networkStackId}-VgwId`);

    const customerGateway = new ec2.CfnCustomerGateway(this, `CustomerGateway-${hieName}`, {
      ipAddress: gatewayPublicIp,
      type: IPSEC_1,
      bgpAsn: 65000,
      tags: [
        {
          key: "Name",
          value: `${hieName}-cgw`,
        },
      ],
    });

    /**
     * Add new rules to the NACL for each of the static IPs we're using for this VPN.
     */
    internalCidrBlocks.forEach((cidr, internalCidrBlockIndex) => {
      /**
       * Each hie's internalCidrBlocks are given some space in the NACL to make it easier
       * to add/remove CIDR blocks in the future. The internalCidrBlockIndex is an offset used
       * in cases where we need to permit traffic from multiple cidr blocks for the same HIE.
       **/
      const offset = props.index * 10 + internalCidrBlockIndex * 3;

      this.addIngressRules(networkAcl, cidr, [
        {
          ruleNumber: 120 + offset,
          traffic: ec2.AclTraffic.tcpPort(MLLP_DEFAULT_PORT),
          ruleAction: ec2.Action.ALLOW,
        },
        // Used to create a point on the NACL to deny all traffic, below which we can
        // add other allow rules for other services the subnet members need to access
        {
          ruleNumber: 1400 + offset,
          traffic: ec2.AclTraffic.allTraffic(),
          ruleAction: ec2.Action.DENY,
        },
      ]);

      this.addEgressRules(networkAcl, cidr, [
        // Outbound TCP handshake traffic
        {
          ruleNumber: 120 + offset,
          traffic: ec2.AclTraffic.tcpPortRange(1024, 65535),
          ruleAction: ec2.Action.ALLOW,
        },
        // Used to create a point on the NACL to deny all traffic, below which we can
        // add other allow rules for other services the subnet members need to access
        {
          ruleNumber: 1400 + offset,
          traffic: ec2.AclTraffic.allTraffic(),
          ruleAction: ec2.Action.DENY,
        },
      ]);
    });

    const presharedKey1 = secret.Secret.fromSecretNameV2(
      this,
      `PresharedKey1-${hieName}`,
      `PresharedKey1-${hieName}`
    );
    const presharedKey2 = secret.Secret.fromSecretNameV2(
      this,
      `PresharedKey2-${hieName}`,
      `PresharedKey2-${hieName}`
    );
    /**
     * We use 2 tunnels here because state HIEs often have a failover to a backup IP..
     */
    const vpnConnection = new ec2.CfnVPNConnection(this, `VpnConnection-${hieName}`, {
      type: IPSEC_1,
      vpnGatewayId: vgwId,
      customerGatewayId: customerGateway.ref,
      staticRoutesOnly: true,
      tags: [
        {
          key: "Name",
          value: `${hieName}-vpn`,
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

    internalCidrBlocks.forEach((cidr, internalCidrBlockIndex) => {
      // Don't specify the index on the first item for backwards compatibility
      const identifier =
        internalCidrBlockIndex === 0
          ? `VpnConnectionRoute${hieName}`
          : `VpnConnectionRoute${hieName}-${internalCidrBlockIndex}`;

      new ec2.CfnVPNConnectionRoute(this, identifier, {
        destinationCidrBlock: cidr,
        vpnConnectionId: vpnConnection.ref,
      });
    });

    new cdk.CfnOutput(this, `VpnConnectionId-${hieName}`, {
      value: vpnConnection.ref,
      description: `VPN Connection for ${hieName}`,
    });
  }

  private setNaclRules(
    networkAcl: ec2.INetworkAcl,
    internalCidrBlock: string,
    direction: ec2.TrafficDirection,
    rules: {
      ruleNumber: number;
      traffic: ec2.AclTraffic;
      ruleAction: ec2.Action;
    }[]
  ) {
    const cidr = ec2.AclCidr.ipv4(internalCidrBlock);

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
    internalCidrBlock: string,
    rules: {
      ruleNumber: number;
      traffic: ec2.AclTraffic;
      ruleAction: ec2.Action;
    }[]
  ) {
    this.setNaclRules(networkAcl, internalCidrBlock, ec2.TrafficDirection.INGRESS, rules);
  }

  private addEgressRules(
    networkAcl: ec2.INetworkAcl,
    internalCidrBlock: string,
    rules: {
      ruleNumber: number;
      traffic: ec2.AclTraffic;
      ruleAction: ec2.Action;
    }[]
  ) {
    this.setNaclRules(networkAcl, internalCidrBlock, ec2.TrafficDirection.EGRESS, rules);
  }
}
