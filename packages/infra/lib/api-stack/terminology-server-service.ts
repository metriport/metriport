import { Duration, NestedStackProps, NestedStack } from "aws-cdk-lib";
import * as cloudwatch from "aws-cdk-lib/aws-cloudwatch";
import { SnsAction } from "aws-cdk-lib/aws-cloudwatch-actions";
import * as ec2 from "aws-cdk-lib/aws-ec2";
import * as ecr_assets from "aws-cdk-lib/aws-ecr-assets";
import * as ecs from "aws-cdk-lib/aws-ecs";
import { FargateService } from "aws-cdk-lib/aws-ecs";
import * as ecs_patterns from "aws-cdk-lib/aws-ecs-patterns";
import { Bucket } from "aws-cdk-lib/aws-s3";
import { Construct } from "constructs";
import { EnvConfig } from "../../config/env-config";
import { getConfig } from "../shared/config";
import { vCPU } from "../shared/fargate";
import { MAXIMUM_LAMBDA_TIMEOUT } from "../shared/lambda";
import { buildLbAccessLogPrefix } from "../shared/s3";
import { addDefaultMetricsToTargetGroup } from "../shared/target-group";
import { isProd } from "../shared/util";

export function settings() {
  const config = getConfig();
  const prod = isProd(config);
  // Watch out for the combination of vCPUs and memory, more vCPU requires more memory
  // https://docs.aws.amazon.com/AmazonECS/latest/developerguide/task_definition_parameters.html#task_size
  const cpuAmount = prod ? 4 : 2;
  return {
    cpuAmount,
    cpu: cpuAmount * vCPU,
    memoryLimitMiB: prod ? 8192 : 4096,
    taskCountMin: prod ? 2 : 1,
    taskCountMax: prod ? 10 : 2,
    // How long this service can run for
    maxExecutionTimeout: MAXIMUM_LAMBDA_TIMEOUT,
  };
}

interface TerminologyServerNestedStackProps extends NestedStackProps {
  config: EnvConfig;
  version: string | undefined;
  generalBucket: Bucket;
  vpc: ec2.IVpc;
  alarmAction: SnsAction | undefined;
}

interface TermServerServiceProps {
  config: EnvConfig;
  version?: string;
  generalBucket: Bucket;
}

export class TerminologyServerNestedStack extends NestedStack {
  public readonly serviceAddress: string;

  constructor(scope: Construct, id: string, props: TerminologyServerNestedStackProps) {
    super(scope, id, props);

    const { address } = createTermServerService(
      this,
      {
        config: props.config,
        version: props.version,
        generalBucket: props.generalBucket,
      },
      props.vpc,
      props.alarmAction
    );

    this.serviceAddress = address;
  }
}

export function createTermServerService(
  stack: Construct,
  props: TermServerServiceProps,
  vpc: ec2.IVpc,
  alarmAction: SnsAction | undefined
): { service: FargateService; address: string } {
  const { cpu, memoryLimitMiB, taskCountMin, taskCountMax, maxExecutionTimeout } = settings();

  const cluster = new ecs.Cluster(stack, "TermServerCluster", { vpc, containerInsights: true });

  const dockerImage = new ecr_assets.DockerImageAsset(stack, "TermServerImage", {
    directory: "../terminology",
  });

  const fargateService = new ecs_patterns.ApplicationLoadBalancedFargateService(
    stack,
    "TermServerFargateService",
    {
      cluster: cluster,
      cpu,
      memoryLimitMiB,
      desiredCount: taskCountMin,
      taskImageOptions: {
        image: ecs.ContainerImage.fromDockerImageAsset(dockerImage),
        containerPort: 8080,
        containerName: "Terminology-Server",
        environment: {
          NODE_ENV: "production", // Determines its being run in the cloud, the logical env is set on ENV_TYPE
          ENV_TYPE: props.config.environmentType, // staging, production, sandbox
          ...(props.version ? { METRIPORT_VERSION: props.version } : undefined),
          TERMINOLOGY_BUCKET: props.generalBucket.bucketName,
        },
      },
      healthCheckGracePeriod: Duration.seconds(60),
      publicLoadBalancer: false,
      idleTimeout: maxExecutionTimeout,
    }
  );

  // Enable Availability Zone rebalancing for the underlying ECS service
  (fargateService.service.node.defaultChild as ecs.CfnService).availabilityZoneRebalancing =
    "ENABLED";

  const serverAddress = fargateService.loadBalancer.loadBalancerDnsName;

  props.generalBucket.grantReadWrite(fargateService.taskDefinition.taskRole);

  fargateService.loadBalancer.logAccessLogs(
    props.generalBucket,
    buildLbAccessLogPrefix("term-server")
  );

  // CloudWatch Alarms and Notifications
  const fargateCpuAlarm = fargateService.service
    .metricCpuUtilization()
    .createAlarm(stack, "TermServerCPUAlarm", {
      threshold: 80,
      evaluationPeriods: 3,
      datapointsToAlarm: 2,
      treatMissingData: cloudwatch.TreatMissingData.NOT_BREACHING,
    });
  alarmAction && fargateCpuAlarm.addAlarmAction(alarmAction);
  alarmAction && fargateCpuAlarm.addOkAction(alarmAction);

  const fargateMemoryAlarm = fargateService.service
    .metricMemoryUtilization()
    .createAlarm(stack, "TermServerMemoryAlarm", {
      threshold: 70,
      evaluationPeriods: 3,
      datapointsToAlarm: 2,
      treatMissingData: cloudwatch.TreatMissingData.NOT_BREACHING,
    });
  alarmAction && fargateMemoryAlarm.addAlarmAction(alarmAction);
  alarmAction && fargateMemoryAlarm.addOkAction(alarmAction);

  fargateService.service.connections.allowFrom(
    ec2.Peer.ipv4(vpc.vpcCidrBlock),
    ec2.Port.allTraffic(),
    "Allow traffic from within the VPC to the service secure port"
  );

  fargateService.service.connections.allowFromAnyIpv4(ec2.Port.allTcp());

  fargateService.targetGroup.setAttribute("deregistration_delay.timeout_seconds", "17");

  fargateService.targetGroup.configureHealthCheck({
    healthyThresholdCount: 2,
    interval: Duration.seconds(10),
  });

  const scaling = fargateService.service.autoScaleTaskCount({
    minCapacity: taskCountMin,
    maxCapacity: taskCountMax,
  });
  scaling.scaleOnCpuUtilization("autoscale_cpu", {
    targetUtilizationPercent: 60,
    scaleInCooldown: Duration.minutes(2),
    scaleOutCooldown: Duration.seconds(30),
  });
  scaling.scaleOnMemoryUtilization("autoscale_mem", {
    targetUtilizationPercent: 80,
    scaleInCooldown: Duration.minutes(2),
    scaleOutCooldown: Duration.seconds(30),
  });

  const targetGroup = fargateService.targetGroup;
  addDefaultMetricsToTargetGroup({
    targetGroup,
    scope: stack,
    id: "TermServer",
    alarmAction,
  });

  return { service: fargateService.service, address: serverAddress };
}
