import * as cdk from "aws-cdk-lib";
import * as ec2 from "aws-cdk-lib/aws-ec2";
import { Construct } from "constructs";
import { EnvConfig } from "../config/env-config";

interface VpcPeeringStackProps extends cdk.StackProps {
  config: EnvConfig;
}

/**
 * Stack to establish VPC peering between API VPC and HL7 Notification VPC.
 * This allows Client VPN users connected to the API VPC to access HL7 servers
 * in the HL7 Notification VPC on port 2575.
 */

const API_STACK_SUBNAME = "APIVpc";

const HL7_NOTIFICATION_STACK_NAME = "Hl7NotificationStack";
const HL7_NOTIFICATION_VPC_SUBNAME = "Vpc";
export class VpcPeeringStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props: VpcPeeringStackProps) {
    super(scope, id, props);

    if (!props.config.hl7Notification) {
      return; // Skip if HL7 notifications are not configured
    }

    // Import existing VPCs by their known construct IDs
    const apiVpc = ec2.Vpc.fromLookup(this, "ImportedApiVpc", {
      vpcName: `${props.config.stackName}/${API_STACK_SUBNAME}`,
    });

    const hl7Vpc = ec2.Vpc.fromLookup(this, "ImportedHl7Vpc", {
      vpcName: `${HL7_NOTIFICATION_STACK_NAME}/${HL7_NOTIFICATION_VPC_SUBNAME}`,
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

    this.addMinimalRoutesToApiVpc(apiVpc, vpcPeeringConnection);
    this.addReturnRoutesToHl7Vpc(hl7Vpc, apiVpc.vpcCidrBlock, vpcPeeringConnection);

    // Update HL7 VPC's Network ACL to allow egress traffic back to API VPC
    this.updateHl7NetworkAclForPeering(apiVpc.vpcCidrBlock);

    // Outputs
    new cdk.CfnOutput(this, "VpcPeeringConnectionId", {
      description: "VPC Peering Connection ID between API and HL7 VPCs",
      value: vpcPeeringConnection.ref,
    });

    new cdk.CfnOutput(this, "ApiVpcId", {
      description: "API VPC ID",
      value: apiVpc.vpcId,
    });

    new cdk.CfnOutput(this, "Hl7VpcId", {
      description: "HL7 VPC ID",
      value: hl7Vpc.vpcId,
    });
  }

  private addMinimalRoutesToApiVpc(
    apiVpc: ec2.IVpc,
    vpcPeeringConnection: ec2.CfnVPCPeeringConnection
  ) {
    // Only add routes for the specific HL7 server IPs (10.1.1.20-23)
    const hl7NlbCidr = "10.1.1.20/30";

    // Get route tables from API VPC (where VPN clients connect)
    const apiVpcRouteTables = apiVpc.privateSubnets
      .concat(apiVpc.publicSubnets)
      .map(subnet => subnet.routeTable.routeTableId);

    apiVpcRouteTables.forEach((routeTableId, routeIndex) => {
      new ec2.CfnRoute(this, `ApiToHl7Route${routeIndex}`, {
        routeTableId,
        destinationCidrBlock: hl7NlbCidr,
        vpcPeeringConnectionId: vpcPeeringConnection.ref,
      });
    });
  }

  private addReturnRoutesToHl7Vpc(
    hl7Vpc: ec2.IVpc,
    apiVpcCidrBlock: string,
    vpcPeeringConnection: ec2.CfnVPCPeeringConnection
  ) {
    // Get all route tables in the HL7 VPC
    const hl7VpcRouteTables = hl7Vpc.privateSubnets
      .concat(hl7Vpc.publicSubnets)
      .map(subnet => subnet.routeTable.routeTableId);

    hl7VpcRouteTables.forEach((routeTableId, index) => {
      new ec2.CfnRoute(this, `Hl7ToApiReturnRoute${index}`, {
        routeTableId,
        destinationCidrBlock: apiVpcCidrBlock, // API VPC CIDR
        vpcPeeringConnectionId: vpcPeeringConnection.ref,
      });
    });
  }

  private updateHl7NetworkAclForPeering(apiVpcCidrBlock: string) {
    // Import the existing Network ACL from HL7 stack
    const networkAclId = cdk.Fn.importValue("NestedNetworkStack-NetworkAclId");
    const networkAcl = ec2.NetworkAcl.fromNetworkAclId(this, "ImportedHl7NetworkAcl", networkAclId);

    // Allow egress traffic back to API VPC (for VPC peering response traffic)
    networkAcl.addEntry("AllowApiVpcEgress", {
      ruleNumber: 4500,
      direction: ec2.TrafficDirection.EGRESS,
      traffic: ec2.AclTraffic.tcpPortRange(1024, 65535), // Ephemeral ports for responses
      ruleAction: ec2.Action.ALLOW,
      cidr: ec2.AclCidr.ipv4(apiVpcCidrBlock),
    });
  }
}
