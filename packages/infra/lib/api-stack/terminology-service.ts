import { Duration, CfnOutput } from "aws-cdk-lib";
import * as ec2 from "aws-cdk-lib/aws-ec2";
import * as ecs from "aws-cdk-lib/aws-ecs";
import * as ecr from "aws-cdk-lib/aws-ecr";
import * as ecs_patterns from "aws-cdk-lib/aws-ecs-patterns";
import { Construct } from "constructs";
import { getConfig } from "../shared/config";
import { isProd } from "../shared/util";
import { vCPU } from "../shared/fargate";

function getSettings(): {
  cpuAmount: number;
  cpu: number;
  memoryLimitMiB: number;
  taskCountMin: number;
  taskCountMax: number;
} {
  const config = getConfig();
  const prod = isProd(config);
  // Watch out for the combination of vCPUs and memory, more vCPU requires more memory
  // https://docs.aws.amazon.com/AmazonECS/latest/developerguide/task_definition_parameters.html#task_size
  const cpuAmount = prod ? 4 : 2;
  return {
    cpuAmount,
    cpu: cpuAmount * vCPU,
    memoryLimitMiB: prod ? 8192 : 4096,
    taskCountMin: prod ? 1 : 1,
    taskCountMax: prod ? 4 : 2,
  };
}

export function createTerminologyService({
  stack,
  vpc,
}: {
  stack: Construct;
  vpc: ec2.IVpc;
}): ecs_patterns.ApplicationLoadBalancedFargateService {
  const settings = getSettings();

  const cluster = new ecs.Cluster(stack, "TerminologyCluster", { vpc, containerInsights: true });
  const ecrRepo = ecr.Repository.fromRepositoryName(
    stack,
    "TerminologyECRRepo",
    "metriport/hawthorn"
  );

  // Define the Fargate task definition
  const taskDefinition = new ecs.FargateTaskDefinition(stack, "TerminologyTaskDef", {
    memoryLimitMiB: settings.memoryLimitMiB,
    cpu: settings.cpu,
  });

  // Add container to the task definition
  taskDefinition.addContainer("TerminologyContainer", {
    image: ecs.ContainerImage.fromEcrRepository(ecrRepo, "latest"),
    logging: ecs.LogDrivers.awsLogs({ streamPrefix: "Terminology" }),
    portMappings: [{ containerPort: 29927, hostPort: 29927, protocol: ecs.Protocol.TCP }],
  });

  // Create the Fargate service
  const fargateService = new ecs_patterns.ApplicationLoadBalancedFargateService(
    stack,
    "TerminologyFargateService",
    {
      cluster,
      taskDefinition,
      desiredCount: settings.taskCountMin,
      healthCheckGracePeriod: Duration.seconds(60),
      publicLoadBalancer: false,
    }
  );

  const securityGroup = new ec2.SecurityGroup(stack, "TerminologyServiceSG", {
    vpc,
    description: "Allow access to the Terminology service from within the VPC",
    allowAllOutbound: true,
  });

  // Allow traffic from within the VPC
  securityGroup.addIngressRule(
    ec2.Peer.ipv4(vpc.vpcCidrBlock),
    ec2.Port.tcp(80),
    "Allow HTTP traffic from within the VPC"
  );

  fargateService.service.connections.addSecurityGroup(securityGroup);

  // This speeds up deployments so the tasks are swapped quicker.
  // See for details: https://docs.aws.amazon.com/elasticloadbalancing/latest/application/load-balancer-target-groups.html#deregistration-delay
  fargateService.targetGroup.setAttribute("deregistration_delay.timeout_seconds", "17");

  // This also speeds up deployments so the health checks have a faster turnaround.
  // See for details: https://docs.aws.amazon.com/elasticloadbalancing/latest/network/target-group-health-checks.html
  fargateService.targetGroup.configureHealthCheck({
    healthyThresholdCount: 2,
    interval: Duration.seconds(10),
  });

  const scaling = fargateService.service.autoScaleTaskCount({
    minCapacity: settings.taskCountMin,
    maxCapacity: settings.taskCountMax,
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

  new CfnOutput(stack, "TerminologyServiceDNS", {
    value: fargateService.loadBalancer.loadBalancerDnsName,
  });

  return fargateService;
}
