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
import { getConfig } from "../shared/config";
import { vCPU } from "../shared/fargate";
import { MAXIMUM_LAMBDA_TIMEOUT } from "../shared/lambda";
import { isProd } from "../shared/util";
import { NetworkStackOutput } from "./network";

const MLLP_DEFAULT_PORT = 2575;

export function settings() {
  const config = getConfig();
  const prod = isProd(config);
  const cpuAmount = prod ? 4 : 1;
  return {
    cpuAmount,
    cpu: cpuAmount * vCPU,
    memoryLimitMiB: prod ? 8192 : 2048,
    taskCountMin: prod ? 4 : 2,
    taskCountMax: prod ? 15 : 4,
    maxExecutionTimeout: MAXIMUM_LAMBDA_TIMEOUT,
  };
}

interface ApplicationStackProps extends cdk.StackProps {
  config: EnvConfig;
  version: string | undefined;
  networkStack: NetworkStackOutput;
}

export class ApplicationStack extends cdk.NestedStack {
  constructor(scope: Construct, id: string, props: ApplicationStackProps) {
    super(scope, id, props);

    const { cpu, memoryLimitMiB, taskCountMin, taskCountMax } = settings();
    const { vpc, nlb, serviceSecurityGroup } = props.networkStack;

    const cluster = new ecs.Cluster(this, "Cluster", {
      vpc,
      containerInsights: true,
    });

    const dockerImage = new ecr_assets.DockerImageAsset(this, "Image", {
      directory: "../hl7v2-server",
      platform: ecr_assets.Platform.LINUX_AMD64,
    });

    const fargateService = new ecs_patterns.NetworkLoadBalancedFargateService(
      this,
      "FargateService",
      {
        cluster,
        cpu,
        memoryLimitMiB,
        desiredCount: taskCountMin,
        taskImageOptions: {
          image: ecs.ContainerImage.fromDockerImageAsset(dockerImage),
          containerPort: MLLP_DEFAULT_PORT,
          containerName: "MllpServer",
          environment: {
            NODE_ENV: "production",
            ENV_TYPE: props.config.environmentType,
            HL7_PORT: MLLP_DEFAULT_PORT.toString(),
          },
        },
        listenerPort: MLLP_DEFAULT_PORT,
        healthCheckGracePeriod: Duration.seconds(60),
        taskSubnets: {
          subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS,
        },
        publicLoadBalancer: true,
        loadBalancer: nlb,
        securityGroups: [serviceSecurityGroup],
      }
    );

    fargateService.targetGroup.configureHealthCheck({
      port: MLLP_DEFAULT_PORT.toString(),
      protocol: elbv2.Protocol.TCP,
      healthyThresholdCount: 5,
      unhealthyThresholdCount: 2,
      timeout: Duration.seconds(10),
      interval: Duration.seconds(30),
    });

    const scaling = fargateService.service.autoScaleTaskCount({
      minCapacity: taskCountMin,
      maxCapacity: taskCountMax,
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

    scaling.scaleOnMetric("ConnectionCountScaling", {
      metric: new cloudwatch.Metric({
        namespace: "AWS/NetworkELB",
        metricName: "ActiveFlowCount",
        dimensionsMap: {
          LoadBalancer: fargateService.loadBalancer.loadBalancerFullName,
        },
        statistic: "Average",
        period: Duration.minutes(1),
      }),
      scalingSteps: [
        { upper: 100, change: -1 },
        { lower: 500, change: +1 },
        { lower: 1000, change: +2 },
      ],
      adjustmentType: appscaling.AdjustmentType.CHANGE_IN_CAPACITY,
    });
  }
}
