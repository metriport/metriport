import * as cdk from "aws-cdk-lib";
import { Duration } from "aws-cdk-lib";
import * as ec2 from "aws-cdk-lib/aws-ec2";
import { Repository } from "aws-cdk-lib/aws-ecr";
import * as ecs from "aws-cdk-lib/aws-ecs";
import * as elbv2 from "aws-cdk-lib/aws-elasticloadbalancingv2";
import { Construct } from "constructs";
import { EnvConfigNonSandbox } from "../../config/env-config";
import { MLLP_DEFAULT_PORT } from "./constants";

interface MllpStackProps extends cdk.StackProps {
  config: EnvConfigNonSandbox;
  version: string | undefined;
  vpc: ec2.Vpc;
  ecrRepo: Repository;
}

export class MllpStack extends cdk.NestedStack {
  constructor(scope: Construct, id: string, props: MllpStackProps) {
    super(scope, id, props);

    const { vpc, ecrRepo } = props;
    const base64ScramblerSeed = props.config.hl7Notification.base64ScramblerSeed;
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

    const nlb = new elbv2.NetworkLoadBalancer(this, "MllpServerNLB", {
      vpc,
      internetFacing: false,
      vpcSubnets: {
        subnets: vpc.privateSubnets,
      },
    });

    const listener = nlb.addListener("MllpListener", {
      port: MLLP_DEFAULT_PORT,
    });

    const targetGroup = listener.addTargets("MllpTargets", {
      port: MLLP_DEFAULT_PORT,
      protocol: elbv2.Protocol.TCP,
      healthCheck: {
        port: MLLP_DEFAULT_PORT.toString(),
        protocol: elbv2.Protocol.TCP,
        healthyThresholdCount: 3,
        unhealthyThresholdCount: 2,
        timeout: Duration.seconds(10),
        interval: Duration.seconds(20),
      },
    });

    // Create Fargate Service
    const taskDefinition = new ecs.FargateTaskDefinition(this, "MllpServerTask", {
      cpu: fargateCpu,
      memoryLimitMiB: fargateMemoryLimitMiB,
    });

    taskDefinition.addContainer("MllpServer", {
      image: ecs.ContainerImage.fromEcrRepository(ecrRepo, "latest"),
      environment: {
        NODE_ENV: "production",
        ENV_TYPE: props.config.environmentType,
        MLLP_PORT: MLLP_DEFAULT_PORT.toString(),
        HL7_BASE64_SCRAMBLER_SEED: base64ScramblerSeed,
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

    targetGroup.addTarget(fargateService);

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

    new cdk.CfnOutput(this, "MllpNlbDnsName", {
      value: nlb.loadBalancerDnsName,
      description: "DNS name of the Network Load Balancer for MLLP",
    });
  }
}
