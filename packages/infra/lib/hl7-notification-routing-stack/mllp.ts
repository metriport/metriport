import * as cdk from "aws-cdk-lib";
import { Duration } from "aws-cdk-lib";
import * as appscaling from "aws-cdk-lib/aws-autoscaling";
import * as cloudwatch from "aws-cdk-lib/aws-cloudwatch";
import * as ec2 from "aws-cdk-lib/aws-ec2";
import * as ecr_assets from "aws-cdk-lib/aws-ecr-assets";
import * as ecs from "aws-cdk-lib/aws-ecs";
import * as ecs_patterns from "aws-cdk-lib/aws-ecs-patterns";
import * as elbv2 from "aws-cdk-lib/aws-elasticloadbalancingv2";
import { Construct } from "constructs";
import { EnvConfig } from "../../config/env-config";
import { MLLP_DEFAULT_PORT } from "../shared/constants";
import { NetworkStackOutput } from "./network";

interface MllpStackProps extends cdk.StackProps {
  config: EnvConfig;
  version: string | undefined;
  networkStack: NetworkStackOutput;
}

export class MllpStack extends cdk.NestedStack {
  constructor(scope: Construct, id: string, props: MllpStackProps) {
    super(scope, id, props);

    const { fargateCpu, fargateMemoryLimitMiB, fargateTaskCountMin, fargateTaskCountMax } =
      props.config.hl7NotificationRouting.mllpServer;
    const { vpc, nlb } = props.networkStack;

    const cluster = new ecs.Cluster(this, "MllpServerCluster", {
      vpc,
      containerInsights: true,
    });

    const dockerImage = new ecr_assets.DockerImageAsset(this, "MllpServerImage", {
      directory: "../mllp-server",
      platform: ecr_assets.Platform.LINUX_AMD64,
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
        image: ecs.ContainerImage.fromDockerImageAsset(dockerImage),
        containerPort: MLLP_DEFAULT_PORT,
        containerName: "MllpServer",
        environment: {
          NODE_ENV: "production",
          ENV_TYPE: props.config.environmentType,
          MLLP_PORT: MLLP_DEFAULT_PORT.toString(),
        },
      },
      listenerPort: MLLP_DEFAULT_PORT,
      healthCheckGracePeriod: Duration.seconds(60),
      taskSubnets: {
        subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS,
      },
      publicLoadBalancer: true,
      loadBalancer: nlb,
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

    const connectionsPerTaskMetric = new cloudwatch.MathExpression({
      expression: "connections / tasks",
      usingMetrics: {
        connections: new cloudwatch.Metric({
          namespace: "AWS/NetworkELB",
          metricName: "ActiveFlowCount",
          dimensionsMap: {
            LoadBalancer: fargate.loadBalancer.loadBalancerFullName,
          },
          statistic: "Average",
          period: Duration.minutes(1),
        }),
        tasks: new cloudwatch.Metric({
          namespace: "ECS/ContainerInsights",
          metricName: "RunningTaskCount",
          dimensionsMap: {
            ClusterName: cluster.clusterName,
            ServiceName: fargate.service.serviceName,
          },
          statistic: "Average",
          // This only changes when we establish a new HIE connection, so this can be updated infrequently
          period: Duration.minutes(15),
        }),
      },
    });

    scaling.scaleOnMetric("ConnectionCountScaling", {
      metric: connectionsPerTaskMetric,
      scalingSteps: [
        { lower: 0, upper: 70, change: -1 },
        { lower: 71, upper: 100, change: 0 },
        { lower: 101, change: +1 },
      ],
      adjustmentType: appscaling.AdjustmentType.CHANGE_IN_CAPACITY,
    });
  }
}
