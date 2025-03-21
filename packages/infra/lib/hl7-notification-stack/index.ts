import * as cdk from "aws-cdk-lib";
import * as ec2 from "aws-cdk-lib/aws-ec2";
import { Repository } from "aws-cdk-lib/aws-ecr";
import { Construct } from "constructs";
import { EnvConfigNonSandbox } from "../../config/env-config";
import { MetriportCompositeStack } from "../shared/metriport-composite-stack";
import { MllpStack } from "./mllp";
import { NetworkStack } from "./network";
import { OTHER_INTERNAL_SERVICES_SUBNET_GROUP_NAME } from "./constants";
import { VPN_ACCESSIBLE_SUBNET_GROUP_NAME } from "./constants";
import { VpnStack } from "./vpn";

export interface Hl7NotificationStackProps extends cdk.StackProps {
  config: EnvConfigNonSandbox;
  version: string | undefined;
}

const NUM_AZS = 2;

export class Hl7NotificationStack extends MetriportCompositeStack {
  public readonly networkStack: NetworkStack;
  public readonly mllpStack: MllpStack;

  constructor(scope: Construct, id: string, props: Hl7NotificationStackProps) {
    super(scope, id, props);

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
          name: OTHER_INTERNAL_SERVICES_SUBNET_GROUP_NAME,
          subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS,
        },
      ],
    });

    const ecrRepo = new Repository(this, "MllpServerRepo", {
      repositoryName: "metriport/mllp-server",
      lifecycleRules: [{ maxImageCount: 5000 }],
    });

    this.mllpStack = new MllpStack(this, "NestedMllpStack", {
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

    props.config.hl7Notification.vpnConfigs.forEach(config => {
      new VpnStack(this, `NestedVpnStack${config.partnerName}`, {
        vpnConfig: config,
        vpc,
        networkStack: this.networkStack.output,
        mllpStack: this.mllpStack.output,
        description: `VPN Configuration for routing HL7 messages from ${config.partnerName}`,
      });
    });

    new cdk.CfnOutput(this, "MllpECRRepoURI", {
      description: "MLLP ECR repository URI",
      value: ecrRepo.repositoryUri,
    });
  }
}
