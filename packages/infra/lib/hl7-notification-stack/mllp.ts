import * as cdk from "aws-cdk-lib";
import { Duration } from "aws-cdk-lib";
import * as ec2 from "aws-cdk-lib/aws-ec2";
import * as s3 from "aws-cdk-lib/aws-s3";
import { Repository } from "aws-cdk-lib/aws-ecr";
import * as ecs from "aws-cdk-lib/aws-ecs";
import * as elbv2 from "aws-cdk-lib/aws-elasticloadbalancingv2";
import { Construct } from "constructs";
import { EnvConfigNonSandbox } from "../../config/env-config";
import { buildSecrets, secretsToECS } from "../shared/secrets";
import {
  MLLP_DEFAULT_PORT,
  MLLP_SERVER_CONTAINER_NAME,
  MLLP_SERVER_NLB_INTERNAL_IP,
} from "./constants";

interface MllpStackProps extends cdk.StackProps {
  config: EnvConfigNonSandbox;
  version: string | undefined;
  vpc: ec2.Vpc;
  ecrRepo: Repository;
  hl7NotificationBucket: s3.Bucket;
}

export class MllpStack extends cdk.NestedStack {
  constructor(scope: Construct, id: string, props: MllpStackProps) {
    super(scope, id, props);

    const { vpc, ecrRepo, hl7NotificationBucket } = props;
    const { fargateCpu, fargateMemoryLimitMiB, fargateTaskCountMin, fargateTaskCountMax } =
      props.config.hl7Notification.mllpServer;

    const cluster = new ecs.Cluster(this, "MllpServerCluster", {
      vpc,
      containerInsights: true,
    });

    const mllpSecurityGroup = new ec2.SecurityGroup(this, "MllpServerSG", {
      vpc,
      description: "Security group for Fargate MLLP server",
      allowAllOutbound: true,
    });

    mllpSecurityGroup.addIngressRule(
      ec2.Peer.anyIpv4(),
      ec2.Port.tcp(MLLP_DEFAULT_PORT),
      `Allow inbound traffic on ${MLLP_DEFAULT_PORT} to MLLP server`
    );

    mllpSecurityGroup.addEgressRule(
      ec2.Peer.anyIpv4(),
      ec2.Port.allTraffic(),
      "Allow outbound traffic from MLLP server"
    );

    const taskDefinition = new ecs.FargateTaskDefinition(this, "MllpServerTask", {
      cpu: fargateCpu,
      memoryLimitMiB: fargateMemoryLimitMiB,
    });

    hl7NotificationBucket.grantWrite(taskDefinition.taskRole);

    taskDefinition.addContainer(MLLP_SERVER_CONTAINER_NAME, {
      image: ecs.ContainerImage.fromEcrRepository(ecrRepo, "latest"),
      secrets: secretsToECS(buildSecrets(this, props.config.hl7Notification.secrets)),
      environment: {
        NODE_ENV: "production",
        ENV_TYPE: props.config.environmentType,
        MLLP_PORT: MLLP_DEFAULT_PORT.toString(),
        HL7_NOTIFICATION_BUCKET_NAME: props.config.hl7Notification.bucketName,
        ...(props.version ? { RELEASE_SHA: props.version } : undefined),
      },
      portMappings: [{ containerPort: MLLP_DEFAULT_PORT }],
    });

    const fargateService = new ecs.FargateService(this, "MllpServerService", {
      cluster,
      taskDefinition,
      desiredCount: fargateTaskCountMin,
      vpcSubnets: {
        subnets: vpc.privateSubnets,
      },
      securityGroups: [mllpSecurityGroup],
    });

    const privateSubnet = vpc.privateSubnets[0];
    if (!privateSubnet || vpc.privateSubnets.length !== 1) {
      throw new Error("Should have exactly one private subnet");
    }

    const nlb = new elbv2.CfnLoadBalancer(this, "MllpNLB", {
      type: "network",
      scheme: "internal",
      subnetMappings: [
        {
          subnetId: privateSubnet.subnetId,
          privateIPv4Address: MLLP_SERVER_NLB_INTERNAL_IP,
        },
      ],
    });

    const targetGroup = new elbv2.CfnTargetGroup(this, "MllpNLBTargets", {
      targets: [
        {
          id: fargateService.serviceName,
          port: MLLP_DEFAULT_PORT,
        },
      ],
      port: MLLP_DEFAULT_PORT,
      protocol: "TCP",
      targetType: "ip",
      vpcId: vpc.vpcId,
      healthyThresholdCount: 3,
      unhealthyThresholdCount: 2,
      healthCheckTimeoutSeconds: 10,
      healthCheckIntervalSeconds: 20,
    });

    new elbv2.CfnListener(this, "MllpNLBListener", {
      loadBalancerArn: nlb.ref,
      port: MLLP_DEFAULT_PORT,
      protocol: "TCP",
      defaultActions: [
        {
          type: "forward",
          targetGroupArn: targetGroup.ref,
        },
      ],
    });

    const scaling = fargateService.autoScaleTaskCount({
      minCapacity: fargateTaskCountMin,
      maxCapacity: fargateTaskCountMax,
    });

    scaling.scaleOnCpuUtilization("CpuScaling", {
      targetUtilizationPercent: 70,
      scaleInCooldown: Duration.seconds(60),
      scaleOutCooldown: Duration.seconds(60),
    });

    scaling.scaleOnMemoryUtilization("MemoryScaling", {
      targetUtilizationPercent: 70,
      scaleInCooldown: Duration.seconds(60),
      scaleOutCooldown: Duration.seconds(60),
    });

    // Add CloudFormation outputs
    new cdk.CfnOutput(this, "MllpClusterArn", {
      value: cluster.clusterArn,
      description: "ARN of the MLLP ECS Cluster",
    });

    new cdk.CfnOutput(this, "MllpServiceArn", {
      value: fargateService.serviceArn,
      description: "ARN of the MLLP Fargate Service",
    });
  }
}
