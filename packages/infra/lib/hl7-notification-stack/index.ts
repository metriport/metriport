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
import { createBucket } from "../shared/bucket";

export interface Hl7NotificationStackProps extends cdk.StackProps {
  config: EnvConfigNonSandbox;
  version: string | undefined;
}

const NUM_AZS = 1;

export class Hl7NotificationStack extends MetriportCompositeStack {
  constructor(scope: Construct, id: string, props: Hl7NotificationStackProps) {
    super(scope, id, props);

    const rawHl7MessageBucket = createBucket(
      this,
      {
        bucketName: props.config.hl7Notification.rawIncomingMessageBucketName,
        versioned: true,
        cors: [
          {
            allowedOrigins: ["*"],
            allowedMethods: [s3.HttpMethods.PUT, s3.HttpMethods.POST],
          },
        ],
      },
      "RawHl7MessageBucket"
    );

    const ecrRepo = new Repository(this, "MllpServerRepo", {
      repositoryName: "metriport/mllp-server",
      lifecycleRules: [{ maxImageCount: 5000 }],
      removalPolicy: cdk.RemovalPolicy.DESTROY,
      emptyOnDelete: true,
    });

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
    vpc.addGatewayEndpoint("S3Endpoint", {
      service: ec2.GatewayVpcEndpointAwsService.S3,
    });
    new ec2.InterfaceVpcEndpoint(this, "EcrApiEndpoint", {
      vpc,
      service: ec2.InterfaceVpcEndpointAwsService.ECR,
      privateDnsEnabled: true,
    });
    new ec2.InterfaceVpcEndpoint(this, "EcrDockerEndpoint", {
      vpc,
      service: ec2.InterfaceVpcEndpointAwsService.ECR_DOCKER,
      privateDnsEnabled: true,
    });
    new ec2.InterfaceVpcEndpoint(this, "CloudWatchLogsEndpoint", {
      vpc,
      service: ec2.InterfaceVpcEndpointAwsService.CLOUDWATCH_LOGS,
      privateDnsEnabled: true,
    });
    new ec2.InterfaceVpcEndpoint(this, "SecretsManagerEndpoint", {
      vpc,
      service: ec2.InterfaceVpcEndpointAwsService.SECRETS_MANAGER,
      privateDnsEnabled: true,
    });
    // TODO ENG-1926: Add or remove these, ECS endpoints are NOT enabled yet - validate with VPC
    // Flow Logs that ECS traffic exceeds 480 GB/month before adding (~$648/month cost).
    // new ec2.InterfaceVpcEndpoint(this, "EcsEndpoint", {
    //   vpc: this.vpc,
    //   service: ec2.InterfaceVpcEndpointAwsService.ECS,
    //   privateDnsEnabled: true,
    // });
    // new ec2.InterfaceVpcEndpoint(this, "EcsAgentEndpoint", {
    //   vpc: this.vpc,
    //   service: ec2.InterfaceVpcEndpointAwsService.ECS_AGENT,
    //   privateDnsEnabled: true,
    // });
    // new ec2.InterfaceVpcEndpoint(this, "EcsTelemetryEndpoint", {
    //   vpc: this.vpc,
    //   service: ec2.InterfaceVpcEndpointAwsService.ECS_TELEMETRY,
    //   privateDnsEnabled: true,
    // });

    new MllpStack(this, "NestedMllpStack", {
      stackName: "NestedMllpStack",
      config: props.config,
      version: props.version,
      vpc,
      ecrRepo,
      rawHl7MessageBucket,
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
