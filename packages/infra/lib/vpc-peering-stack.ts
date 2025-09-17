import * as cdk from "aws-cdk-lib";
import * as ec2 from "aws-cdk-lib/aws-ec2";
import { Construct } from "constructs";
import { EnvConfig } from "../config/env-config";
import { HL7_NLB_CIDR, MLLP_DEFAULT_PORT } from "./hl7-notification-stack/constants";
import { API_STACK_VPC_NAME } from "./constants";
import { HL7_NOTIFICATION_STACK_NAME } from "./constants";
import { HL7_NOTIFICATION_VPC_NAME } from "./constants";

interface VpcPeeringStackProps extends cdk.StackProps {
  config: EnvConfig;
}

/**
 * Stack to establish VPC peering between API VPC and HL7 Notification VPC.
 * This allows Client VPN users connected to the API VPC to access HL7 servers
 * in the HL7 Notification VPC on port 2575.
 */
export class VpcPeeringStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props: VpcPeeringStackProps) {
    super(scope, id, props);

    // Skip if HL7 notifications are not configured
    if (!props.config.hl7Notification) {
      return;
    }

    const apiVpc = ec2.Vpc.fromLookup(this, "ImportedApiVpc", {
      vpcName: `${props.config.stackName}/${API_STACK_VPC_NAME}`,
    });

    const hl7Vpc = ec2.Vpc.fromLookup(this, "ImportedHl7Vpc", {
      vpcName: `${HL7_NOTIFICATION_STACK_NAME}/${HL7_NOTIFICATION_VPC_NAME}`,
    });

    // Create VPC Peering Connection
    const vpcPeeringConnection = new ec2.CfnVPCPeeringConnection(this, "ApiToHl7VpcPeering", {
      vpcId: apiVpc.vpcId,
      peerVpcId: hl7Vpc.vpcId,
      tags: [
        {
          key: "Name",
          value: "API-to-HL7-VPC-Peering",
        },
      ],
    });

    this.addRoutesToApiVpc(apiVpc, vpcPeeringConnection);
    this.addRoutesToHl7Vpc(hl7Vpc, apiVpc.vpcCidrBlock, vpcPeeringConnection);
    this.updateHl7NetworkAclForPeering(apiVpc.vpcCidrBlock);
  }

  private addRoutesToApiVpc(apiVpc: ec2.IVpc, vpcPeeringConnection: ec2.CfnVPCPeeringConnection) {
    const apiVpcRouteTables = apiVpc.privateSubnets.map(subnet => subnet.routeTable.routeTableId);

    apiVpcRouteTables.forEach((routeTableId, routeIndex) => {
      new ec2.CfnRoute(this, `ApiToHl7Route${routeIndex}`, {
        routeTableId,
        // Only add routes for the nlbs in front of the mllp-server ecs tasks (10.1.1.20-23)
        destinationCidrBlock: HL7_NLB_CIDR,
        vpcPeeringConnectionId: vpcPeeringConnection.ref,
      });
    });
  }

  private addRoutesToHl7Vpc(
    hl7Vpc: ec2.IVpc,
    apiVpcCidrBlock: string,
    vpcPeeringConnection: ec2.CfnVPCPeeringConnection
  ) {
    const hl7VpcRouteTables = hl7Vpc.privateSubnets.map(subnet => subnet.routeTable.routeTableId);

    hl7VpcRouteTables.forEach((routeTableId, index) => {
      new ec2.CfnRoute(this, `Hl7ToApiReturnRoute${index}`, {
        routeTableId,
        destinationCidrBlock: apiVpcCidrBlock, // API VPC CIDR
        vpcPeeringConnectionId: vpcPeeringConnection.ref,
      });
    });
  }

  private updateHl7NetworkAclForPeering(apiVpcCidrBlock: string) {
    const networkAclId = cdk.Fn.importValue("NestedNetworkStack-NetworkAclId");
    const networkAcl = ec2.NetworkAcl.fromNetworkAclId(this, "ImportedHl7NetworkAcl", networkAclId);

    const common = {
      ruleAction: ec2.Action.ALLOW,
      ruleNumber: 4500,
      cidr: ec2.AclCidr.ipv4(apiVpcCidrBlock), // VPN client CIDR
    };

    networkAcl.addEntry(`AllowVpnClientIngress`, {
      ...common,
      direction: ec2.TrafficDirection.INGRESS,
      traffic: ec2.AclTraffic.tcpPort(MLLP_DEFAULT_PORT),
    });

    networkAcl.addEntry(`AllowVpnClientEgress`, {
      ...common,
      direction: ec2.TrafficDirection.EGRESS,
      traffic: ec2.AclTraffic.tcpPortRange(32768, 65535),
    });
  }
}
