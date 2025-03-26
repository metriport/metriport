import * as cdk from "aws-cdk-lib";
import * as ec2 from "aws-cdk-lib/aws-ec2";
import { Repository } from "aws-cdk-lib/aws-ecr";
import { Construct } from "constructs";
import { EnvConfigNonSandbox } from "../../config/env-config";
import { MetriportCompositeStack } from "../shared/metriport-composite-stack";
import { INTERNAL_SERVICES_SUBNET_GROUP_NAME, VPN_ACCESSIBLE_SUBNET_GROUP_NAME } from "./constants";
import { MllpStack } from "./mllp";
import { NetworkStack } from "./network";

export interface Hl7NotificationStackProps extends cdk.StackProps {
  config: EnvConfigNonSandbox;
  version: string | undefined;
}

const NUM_AZS = 2;

export class Hl7NotificationStack extends MetriportCompositeStack {
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

    new NetworkStack(this, "NestedNetworkStack", {
      stackName: "NestedNetworkStack",
      config: props.config,
      vpc,
      description: "HL7 Notification Routing Network Infrastructure",
    });

    new cdk.CfnOutput(this, "MllpECRRepoURI", {
      description: "MLLP ECR repository URI",
      value: ecrRepo.repositoryUri,
    });
  }
}
