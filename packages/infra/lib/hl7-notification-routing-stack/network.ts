import * as cdk from "aws-cdk-lib";
import * as ec2 from "aws-cdk-lib/aws-ec2";
import * as elbv2 from "aws-cdk-lib/aws-elasticloadbalancingv2";
import { Construct } from "constructs";
import { EnvConfig } from "../../config/env-config";

const NUM_AZS = 2;

interface NetworkStackProps extends cdk.StackProps {
  config: EnvConfig;
}

export interface NetworkStackOutput {
  vpc: ec2.Vpc;
  nlb: elbv2.NetworkLoadBalancer;
}

export class NetworkStack extends cdk.NestedStack {
  public readonly output: NetworkStackOutput;

  constructor(scope: Construct, id: string, props: NetworkStackProps) {
    super(scope, id, props);

    const vpc = new ec2.Vpc(this, "Vpc", {
      maxAzs: NUM_AZS,
      natGateways: NUM_AZS,
    });

    const nlb = new elbv2.NetworkLoadBalancer(this, "NLB", {
      vpc,
      crossZoneEnabled: true,
      ipAddressType: elbv2.IpAddressType.IPV4,
      vpcSubnets: { subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS },
    });

    const cfnNLB = nlb.node.defaultChild as elbv2.CfnLoadBalancer;
    cfnNLB.subnets = undefined;
    cfnNLB.subnetMappings = vpc.publicSubnets.map((subnet, index) => {
      const eip = createEipWithTags(
        this,
        `EipForAvailabilityZone${index + 1}`,
        props.config.stackName,
        props.config.environmentType
      );

      return {
        subnetId: subnet.subnetId,
        allocationId: eip.attrAllocationId,
      };
    });

    this.output = {
      vpc,
      nlb,
    };

    new cdk.CfnOutput(this, "NlbDnsName", {
      value: nlb.loadBalancerDnsName,
    });
  }
}

/**
 * Our EIPs are retained after stack deletion to avoid disruption of existing connections with state HIEs.
 * Losing our EIPs would create a nationwide ADT outage for us until all state HIEs re-register their gateways.
 */
function createEipWithTags(scope: Construct, id: string, stackName: string, envType: string) {
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
        value: "MLLP Server NLB Static IP",
      },
    ],
  });
  eip.applyRemovalPolicy(cdk.RemovalPolicy.RETAIN);

  new cdk.CfnOutput(scope, `${id}Output`, {
    value: eip.ref,
    description: "Static IP for MLLP Server NLB",
  });

  return eip;
}
