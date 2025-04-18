import * as cdk from "aws-cdk-lib";
import * as ec2 from "aws-cdk-lib/aws-ec2";
import { Repository } from "aws-cdk-lib/aws-ecr";
import * as s3 from "aws-cdk-lib/aws-s3";
import { Construct } from "constructs";
import { EnvConfigNonSandbox } from "../../config/env-config";
import { MetriportCompositeStack } from "../shared/metriport-composite-stack";
import { HL7_NOTIFICATION_VPC_CIDR } from "./constants";
import { MllpStack } from "./mllp";
import { NetworkStack } from "./network";

export interface Hl7NotificationStackProps extends cdk.StackProps {
  config: EnvConfigNonSandbox;
  version: string | undefined;
  hl7NotificationBucket: s3.Bucket;
  incomingHl7NotificationBucket: s3.Bucket;
}

const NUM_AZS = 1;

export class Hl7NotificationStack extends MetriportCompositeStack {
  constructor(scope: Construct, id: string, props: Hl7NotificationStackProps) {
    super(scope, id, props);

    const vpc = new ec2.Vpc(this, "Vpc", {
      maxAzs: NUM_AZS,
      ipAddresses: ec2.IpAddresses.cidr(HL7_NOTIFICATION_VPC_CIDR),
      subnetConfiguration: [
        {
          cidrMask: 24,
          name: "Public",
          subnetType: ec2.SubnetType.PUBLIC,
        },
        {
          cidrMask: 24,
          name: "Private-VpnAccessible-MllpServer",
          subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS,
        },
      ],
    });

    new ec2.InterfaceVpcEndpoint(this, "Hl7NotificationVpcSqsEndpoint", {
      vpc,
      service: ec2.InterfaceVpcEndpointAwsService.SQS,
      privateDnsEnabled: true,
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
      hl7NotificationBucket: props.hl7NotificationBucket,
      incomingHl7NotificationBucket: props.incomingHl7NotificationBucket,
      description: "HL7 Notification MLLP Server",
    });

    new NetworkStack(this, "NestedNetworkStack", {
      stackName: "NestedNetworkStack",
      config: props.config,
      vpc,
      description: "HL7 Notification Network Infrastructure",
    });

    new cdk.CfnOutput(this, "MllpECRRepoURI", {
      description: "MLLP ECR repository URI",
      value: ecrRepo.repositoryUri,
    });
  }
}
