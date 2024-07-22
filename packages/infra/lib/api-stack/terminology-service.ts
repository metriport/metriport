import { Duration, CfnOutput } from "aws-cdk-lib";
import * as ec2 from "aws-cdk-lib/aws-ec2";
import * as ecs from "aws-cdk-lib/aws-ecs";
import * as ecr from "aws-cdk-lib/aws-ecr";
import * as servicediscovery from "aws-cdk-lib/aws-servicediscovery";
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
}): ecs.FargateService {
  // Create a new Amazon Elastic Container Service (ECS) cluster
  const cluster = new ecs.Cluster(stack, "TerminologyCluster", { vpc, containerInsights: true });

  const settings = getSettings();

  // Define the Fargate task definition
  const taskDefinition = new ecs.FargateTaskDefinition(stack, "TerminologyTaskDef", {
    memoryLimitMiB: settings.memoryLimitMiB,
    cpu: settings.cpu,
  });

  const ecrRepo = ecr.Repository.fromRepositoryName(
    stack,
    "TerminologyECRRepo",
    "metriport/hawthorn"
  );

  // Add container to the task definition
  taskDefinition.addContainer("TerminologyContainer", {
    image: ecs.ContainerImage.fromEcrRepository(ecrRepo, "latest"),
    logging: ecs.LogDrivers.awsLogs({ streamPrefix: "Terminology" }),
  });

  // Create the Fargate service
  const fargateService = new ecs.FargateService(stack, "TerminologyFargateService", {
    cluster,
    taskDefinition,
    desiredCount: settings.taskCountMin,
    healthCheckGracePeriod: Duration.seconds(60),
  });

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

  fargateService.connections.addSecurityGroup(securityGroup);

  const namespace = new servicediscovery.PrivateDnsNamespace(stack, "TerminologyNamespace", {
    name: "Terminology.local",
    vpc,
  });

  const service = namespace.createService("TerminologyService", {
    dnsRecordType: servicediscovery.DnsRecordType.A,
    dnsTtl: Duration.seconds(60),
    loadBalancer: false,
  });

  fargateService.associateCloudMapService({
    service,
  });

  new CfnOutput(stack, "TerminologyServiceDNS", {
    description: "DNS name of the Terminology service",
    value: `${service.serviceName}.${namespace.namespaceName}`,
  });

  return fargateService;
}
