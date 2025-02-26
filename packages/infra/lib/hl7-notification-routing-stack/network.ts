/* eslint-disable */
// @ts-nocheck

import * as cdk from "aws-cdk-lib";
import * as ec2 from "aws-cdk-lib/aws-ec2";
import * as elbv2 from "aws-cdk-lib/aws-elasticloadbalancingv2";
import { Construct } from "constructs";
import { EnvConfig } from "../../config/env-config";
const NUM_AZS = 2;
const MLLP_DEFAULT_PORT = 2575;

interface NetworkStackProps extends cdk.StackProps {
  config: EnvConfig;
}

export interface NetworkStackOutput {
  vpc: ec2.Vpc;
  nlb: elbv2.NetworkLoadBalancer;
  serviceSecurityGroup: ec2.SecurityGroup;
  eipAddresses: string[];
}

export class NetworkStack extends cdk.NestedStack {
  public readonly output: NetworkStackOutput;

  constructor(scope: Construct, id: string, props: NetworkStackProps) {
    super(scope, id, props);

    const vpc = new ec2.Vpc(this, "Vpc", {
      maxAzs: NUM_AZS,
    });

    /**
     * Our EIPs are retained after stack deletion to avoid disruption of existing connections with state HIEs.
     * Losing our EIPs would create a nationwide ADT outage for us until all state HIEs re-register their gateways.
     */
    const eip1 = createEIPWithTags(
      this,
      "Eip1",
      props.config.stackName,
      props.config.environmentType
    );
    const eip2 = createEIPWithTags(
      this,
      "Eip2",
      props.config.stackName,
      props.config.environmentType
    );

    const nlb = new elbv2.NetworkLoadBalancer(this, "NLB", {
      vpc,
      internetFacing: true,
      crossZoneEnabled: true,
      ipAddressType: elbv2.IpAddressType.IPV4,
      vpcSubnets: { subnetType: ec2.SubnetType.PUBLIC },
    });

    const cfnNLB = nlb.node.defaultChild as elbv2.CfnLoadBalancer;
    cfnNLB.subnets = undefined;
    cfnNLB.subnetMappings = [
      {
        subnetId: vpc.publicSubnets[0].subnetId,
        allocationId: eip1.attrAllocationId,
      },
      {
        subnetId: vpc.publicSubnets[1].subnetId,
        allocationId: eip2.attrAllocationId,
      },
    ];

    const serviceSecurityGroup = new ec2.SecurityGroup(this, "ServiceSG", {
      vpc,
      description: "Security group for HL7v2 Fargate service",
      allowAllOutbound: true,
    });

    serviceSecurityGroup.addIngressRule(
      ec2.Peer.anyIpv4(),
      ec2.Port.tcp(MLLP_DEFAULT_PORT),
      "Allow MLLP traffic"
    );

    this.output = {
      vpc,
      nlb,
      serviceSecurityGroup,
      eipAddresses: [eip1.ref, eip2.ref],
    };

    // Stack Outputs
    new cdk.CfnOutput(this, "StaticIp1", {
      value: eip1.ref,
      description: "Static IP 1 for HL7v2 Server",
    });

    new cdk.CfnOutput(this, "StaticIp2", {
      value: eip2.ref,
      description: "Static IP 2 for HL7v2 Server",
    });

    new cdk.CfnOutput(this, "NlbDnsName", {
      value: nlb.loadBalancerDnsName,
    });
  }
}

function createEIPWithTags(scope: Construct, id: string, stackName: string, envType: string) {
  const eip = new ec2.CfnEIP(scope, id, {
    tags: [
      {
        key: "Name",
        value: `${stackName}-${id.toLowerCase()}`,
      },
      {
        key: "Environment",
        value: envType,
      },
      {
        key: "Purpose",
        value: "HL7v2 NLB Static IP",
      },
    ],
  });
  eip.applyRemovalPolicy(cdk.RemovalPolicy.RETAIN);
  return eip;
}
