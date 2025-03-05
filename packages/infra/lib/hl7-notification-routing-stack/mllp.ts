import * as cdk from "aws-cdk-lib";
import { Duration } from "aws-cdk-lib";
import * as ec2 from "aws-cdk-lib/aws-ec2";
import { Repository } from "aws-cdk-lib/aws-ecr";
import * as ecs from "aws-cdk-lib/aws-ecs";
import * as ecs_patterns from "aws-cdk-lib/aws-ecs-patterns";
import * as elbv2 from "aws-cdk-lib/aws-elasticloadbalancingv2";
import { Construct } from "constructs";
import { EnvConfigNonSandbox } from "../../config/env-config";
import { NetworkStackOutput } from "./network";

const MLLP_DEFAULT_PORT = 2575;

interface MllpStackProps extends cdk.StackProps {
  config: EnvConfigNonSandbox;
  version: string | undefined;
  networkStack: NetworkStackOutput;
}

export class MllpStack extends cdk.NestedStack {
  constructor(scope: Construct, id: string, props: MllpStackProps) {
    super(scope, id, props);

    const { fargateCpu, fargateMemoryLimitMiB, fargateTaskCountMin, fargateTaskCountMax } =
      props.config.hl7NotificationRouting.mllpServer;
    const { vpc } = props.networkStack;

    const cluster = new ecs.Cluster(this, "MllpServerCluster", {
      vpc,
      containerInsights: true,
    });

    const ecrRepo = new Repository(this, "MllpServerRepo", {
      repositoryName: "metriport/mllp-server",
      lifecycleRules: [{ maxImageCount: 5000 }],
    });
    new cdk.CfnOutput(this, "MllpECRRepoURI", {
      description: "MLLP ECR repository URI",
      value: ecrRepo.repositoryUri,
    });

    const mllpSecurityGroup = new ec2.SecurityGroup(this, "MllpServerSG", {
      vpc,
      description: "Security group for Fargate MLLP server",
      allowAllOutbound: true,
    });

    mllpSecurityGroup.addIngressRule(
      ec2.Peer.anyIpv4(),
      ec2.Port.tcp(MLLP_DEFAULT_PORT),
      "Allow inbound traffic to MLLP server"
    );

    const fargate = new ecs_patterns.NetworkLoadBalancedFargateService(this, "MllpServerFargate", {
      cluster,
      cpu: fargateCpu,
      memoryLimitMiB: fargateMemoryLimitMiB,
      desiredCount: fargateTaskCountMin,
      taskImageOptions: {
        image: ecs.ContainerImage.fromEcrRepository(ecrRepo, "latest"),
        containerPort: MLLP_DEFAULT_PORT,
        containerName: "MllpServer",
        environment: {
          NODE_ENV: "production",
          ENV_TYPE: props.config.environmentType,
          MLLP_PORT: MLLP_DEFAULT_PORT.toString(),
          ...(props.version ? { RELEASE_SHA: props.version } : undefined),
        },
      },
      listenerPort: MLLP_DEFAULT_PORT,
      healthCheckGracePeriod: Duration.seconds(60),
      taskSubnets: {
        subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS,
      },
      publicLoadBalancer: false,
      securityGroups: [mllpSecurityGroup],
    });

    fargate.targetGroup.configureHealthCheck({
      port: MLLP_DEFAULT_PORT.toString(),
      protocol: elbv2.Protocol.TCP,
      healthyThresholdCount: 3,
      unhealthyThresholdCount: 2,
      timeout: Duration.seconds(10),
      interval: Duration.seconds(20),
    });

    const scaling = fargate.service.autoScaleTaskCount({
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
  }
}
