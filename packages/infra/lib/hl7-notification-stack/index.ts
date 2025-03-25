import * as cdk from "aws-cdk-lib";
import * as ec2 from "aws-cdk-lib/aws-ec2";
import { Repository } from "aws-cdk-lib/aws-ecr";
import { Construct } from "constructs";
import { EnvConfigNonSandbox } from "../../config/env-config";
import { MetriportCompositeStack } from "../shared/metriport-composite-stack";
import { MllpStack } from "./mllp";
import { NetworkStack } from "./network";
import { VpnStack } from "./vpn";
import { INTERNAL_SERVICES_SUBNET_GROUP_NAME } from "./constants";
import { VPN_ACCESSIBLE_SUBNET_GROUP_NAME } from "./constants";
import { Secret } from "aws-cdk-lib/aws-secretsmanager";
import { VpcPeeringStack } from "../vpc-peering";

export interface Hl7NotificationStackProps extends cdk.StackProps {
  config: EnvConfigNonSandbox;
  version: string | undefined;
}

const NUM_AZS = 2;

const fetchSecretsForPartner = (scope: Construct, partnerName: string) => {
  const secretName = `PresharedKey-${partnerName}`;
  return Secret.fromSecretNameV2(scope, secretName, secretName);
};

export class Hl7NotificationStack extends MetriportCompositeStack {
  public readonly networkStack: NetworkStack;

  constructor(scope: Construct, id: string, props: Hl7NotificationStackProps) {
    super(scope, id, props);
    const { vpnConfigs, apiVpcId } = props.config.hl7Notification;

    const apiVpc = ec2.Vpc.fromLookup(this, "APIVpc", { vpcId: apiVpcId });

    const vpc = new ec2.Vpc(this, "Vpc", {
      maxAzs: NUM_AZS,
      subnetConfiguration: [
        {
          cidrMask: 24,
          name: "Public",
          subnetType: ec2.SubnetType.PUBLIC,
        },
        {
          cidrMask: 24,
          name: VPN_ACCESSIBLE_SUBNET_GROUP_NAME,
          subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS,
        },
        {
          cidrMask: 24,
          name: INTERNAL_SERVICES_SUBNET_GROUP_NAME,
          subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS,
        },
      ],
    });

    const ecrRepo = new Repository(this, "MllpServerRepo", {
      repositoryName: "metriport/mllp-server",
      lifecycleRules: [{ maxImageCount: 5000 }],
    });

    new MllpStack(this, "NestedMllpStack", {
      stackName: "NestedMllpStack",
      config: props.config,
      version: props.version,
      vpc,
      ecrRepo,
      description: "HL7 Notification Routing MLLP Server",
    });

    this.networkStack = new NetworkStack(this, "NestedNetworkStack", {
      stackName: "NestedNetworkStack",
      config: props.config,
      vpc,
      description: "HL7 Notification Routing Network Infrastructure",
    });

    new VpcPeeringStack(this, `NestedVpcPeeringStack`, {
      vpcConfigs: [
        {
          vpc,
          identifier: "Hl7NotificationInternal",
          subnets: vpc.selectSubnets({
            subnetGroupName: INTERNAL_SERVICES_SUBNET_GROUP_NAME,
          }).subnets,
        },
        {
          vpc: apiVpc,
          identifier: "Api",
        },
      ],
    });

    this.networkStack.output.networkAcl.addEntry("Deny all inbound traffic from API VPC", {
      cidr: ec2.AclCidr.ipv4(apiVpc.vpcCidrBlock),
      direction: ec2.TrafficDirection.INGRESS,
      ruleAction: ec2.Action.DENY,
      ruleNumber: 4900,
      traffic: ec2.AclTraffic.allTraffic(),
    });

    this.networkStack.output.networkAcl.addEntry("Deny all outbound traffic to API VPC", {
      cidr: ec2.AclCidr.ipv4(apiVpc.vpcCidrBlock),
      direction: ec2.TrafficDirection.EGRESS,
      ruleAction: ec2.Action.DENY,
      ruleNumber: 4900,
      traffic: ec2.AclTraffic.allTraffic(),
    });

    vpnConfigs.forEach((config, index) => {
      new VpnStack(this, `NestedVpnStack${config.partnerName}`, {
        vpnConfig: { ...config, presharedKey: fetchSecretsForPartner(this, config.partnerName) },
        vpc,
        index,
        networkStack: this.networkStack.output,
        description: `VPN Configuration for routing HL7 messages from ${config.partnerName}`,
      });
    });

    new cdk.CfnOutput(this, "MllpECRRepoURI", {
      description: "MLLP ECR repository URI",
      value: ecrRepo.repositoryUri,
    });
  }
}
