/* eslint-disable @typescript-eslint/no-unused-vars */
import {
  MLLP_SERVER_FIRST_VALID_PORT,
  MLLP_SERVER_LAST_VALID_PORT,
  OLD_MLLP_SERVER_PORT,
  SUPPORTED_MLLP_SERVER_PORTS,
} from "@metriport/core/domain/hl7-notification/utils";
import * as cdk from "aws-cdk-lib";
import { Duration } from "aws-cdk-lib";
import * as ec2 from "aws-cdk-lib/aws-ec2";
import * as ecs from "aws-cdk-lib/aws-ecs";
import * as ecr from "aws-cdk-lib/aws-ecr";
import * as elbv2 from "aws-cdk-lib/aws-elasticloadbalancingv2";
import * as iam from "aws-cdk-lib/aws-iam";
import * as logs from "aws-cdk-lib/aws-logs";
import { LogGroup } from "aws-cdk-lib/aws-logs";
import * as s3 from "aws-cdk-lib/aws-s3";
import { Construct } from "constructs";
import { EnvConfigNonSandbox } from "../../config/env-config";
import { createHieConfigDictionary } from "../shared/hie-config-dictionary";
import { buildSecrets, secretsToECS } from "../shared/secrets";
import { MLLP_SERVER_CONTAINER_NAME } from "./constants";

interface MllpStackProps extends cdk.StackProps {
  config: EnvConfigNonSandbox;
  version: string | undefined;
  vpc: ec2.Vpc;
  ecrRepo: ecr.IRepository;
  rawHl7MessageBucket: s3.IBucket;
}

const setupNlb = (
  identifier: string,
  vpc: ec2.Vpc,
  nlb: elbv2.NetworkLoadBalancer,
  ip: string,
  fargateService: ecs.FargateService
) => {
  const privateSubnet = vpc.privateSubnets[0];
  if (!privateSubnet || vpc.privateSubnets.length !== 1) {
    throw new Error("Should have exactly one private subnet");
  }

  const cfnNlb = nlb.node.defaultChild as elbv2.CfnLoadBalancer;
  cfnNlb.addDeletionOverride("Properties.Subnets");

  cfnNlb.subnetMappings = [
    {
      subnetId: privateSubnet.subnetId,
      privateIPv4Address: ip,
    },
  ];

  const originalListener = nlb.addListener(`MllpListener${identifier}`, {
    port: OLD_MLLP_SERVER_PORT,
  });

  originalListener
    .addTargets(`MllpTargets${identifier}`, {
      port: OLD_MLLP_SERVER_PORT,
      protocol: elbv2.Protocol.TCP,
      preserveClientIp: true,
      healthCheck: {
        port: OLD_MLLP_SERVER_PORT.toString(),
        protocol: elbv2.Protocol.TCP,
        healthyThresholdCount: 3,
        unhealthyThresholdCount: 2,
        timeout: Duration.seconds(10),
        interval: Duration.seconds(30),
      },
    })
    .addTarget(
      fargateService.loadBalancerTarget({
        containerName: MLLP_SERVER_CONTAINER_NAME,
        containerPort: OLD_MLLP_SERVER_PORT,
      })
    );

  // ❗️ BACKWARDS COMPATIBILITY: we are removing the 2575 since it was the original port and re-creating it will cause an error.
  const mllpServerPortsToCreate = SUPPORTED_MLLP_SERVER_PORTS.filter(
    port => port !== OLD_MLLP_SERVER_PORT
  );

  mllpServerPortsToCreate.forEach(port => {
    const listener = nlb.addListener(`MllpListener${identifier}-${port}`, {
      port,
    });

    listener
      .addTargets(`MllpTargets${identifier}-${port}`, {
        port,
        protocol: elbv2.Protocol.TCP,
        preserveClientIp: true,
        healthCheck: {
          port: port.toString(),
          protocol: elbv2.Protocol.TCP,
          healthyThresholdCount: 3,
          unhealthyThresholdCount: 2,
          timeout: Duration.seconds(10),
          interval: Duration.seconds(30),
        },
      })
      .addTarget(
        fargateService.loadBalancerTarget({
          containerName: MLLP_SERVER_CONTAINER_NAME,
          containerPort: port,
        })
      );
  });
};

export class MllpStack extends cdk.NestedStack {
  constructor(scope: Construct, id: string, props: MllpStackProps) {
    super(scope, id, props);

    const { vpc, ecrRepo, rawHl7MessageBucket, config } = props;
    const { notificationWebhookSenderQueue, hieConfigs } = config.hl7Notification;
    const {
      sentryDSN,
      fargateCpu,
      fargateMemoryLimitMiB,
      fargateTaskCountMin,
      fargateTaskCountMax,
      nlbInternalIpAddressA,
      nlbInternalIpAddressB,
    } = props.config.hl7Notification.mllpServer;

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
      ec2.Port.tcpRange(MLLP_SERVER_FIRST_VALID_PORT, MLLP_SERVER_LAST_VALID_PORT),
      `Allow inbound traffic on ${MLLP_SERVER_FIRST_VALID_PORT} to ${MLLP_SERVER_LAST_VALID_PORT} to MLLP server`
    );

    mllpSecurityGroup.addEgressRule(
      ec2.Peer.anyIpv4(),
      ec2.Port.allTraffic(),
      "Allow outbound traffic from MLLP server"
    );

    const nlbA = new elbv2.NetworkLoadBalancer(this, "MllpServerNLB2", {
      vpc,
      internetFacing: false,
    });

    const nlbB = new elbv2.NetworkLoadBalancer(this, "MllpServerNLB2b", {
      vpc,
      internetFacing: false,
    });

    const taskRole = new iam.Role(this, "MllpServerTaskRole", {
      assumedBy: new iam.ServicePrincipal("ecs-tasks.amazonaws.com"),
    });

    taskRole.addToPolicy(
      new iam.PolicyStatement({
        actions: ["sqs:SendMessage"],
        resources: [notificationWebhookSenderQueue.arn],
      })
    );

    const fargateService = new ecs.FargateService(this, "MllpServerService", {
      cluster,
      taskDefinition: new ecs.FargateTaskDefinition(this, "MllpServerTask", {
        cpu: fargateCpu,
        memoryLimitMiB: fargateMemoryLimitMiB,
        taskRole,
      }),
      desiredCount: fargateTaskCountMin,
      vpcSubnets: {
        subnets: vpc.privateSubnets,
      },
      securityGroups: [mllpSecurityGroup],
    });

    // Enable Availability Zone rebalancing for the underlying ECS service
    (fargateService.node.defaultChild as ecs.CfnService).availabilityZoneRebalancing = "ENABLED";

    const logGroup = new LogGroup(this, "MllpServerLogGroup", {
      logGroupName: "/aws/ecs/mllp-server",
      retention: logs.RetentionDays.ONE_YEAR,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
    });

    fargateService.taskDefinition.addContainer("MllpServer", {
      image: ecs.ContainerImage.fromEcrRepository(ecrRepo, "latest"),
      secrets: secretsToECS({
        ...buildSecrets(this, props.config.hl7Notification.secrets),
        ...buildSecrets(this, props.config.analyticsSecretNames),
      }),
      environment: {
        NODE_ENV: "production",
        ENV_TYPE: props.config.environmentType,
        HL7_RAW_MESSAGE_BUCKET_NAME: rawHl7MessageBucket.bucketName,
        HL7_NOTIFICATION_QUEUE_URL: notificationWebhookSenderQueue.url,
        HIE_CONFIG_DICTIONARY: JSON.stringify(createHieConfigDictionary(hieConfigs)),
        ...(sentryDSN ? { SENTRY_DSN: sentryDSN } : {}),
        ...(props.version ? { RELEASE_SHA: props.version } : undefined),
      },
      portMappings: [
        ...SUPPORTED_MLLP_SERVER_PORTS.map(port => ({
          containerPort: port,
        })),
      ],
      logging: ecs.LogDriver.awsLogs({
        logGroup,
        streamPrefix: "mllp-server",
      }),
    });

    /**
     * We're using an empty string for the first setupNlb call to maintain identifiers and
     * avoid having to recreate a new listener and target group for the existing NLB.
     */
    setupNlb("", vpc, nlbA, nlbInternalIpAddressA, fargateService);
    setupNlb("B", vpc, nlbB, nlbInternalIpAddressB, fargateService);

    rawHl7MessageBucket.grantWrite(fargateService.taskDefinition.taskRole);

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

    new cdk.CfnOutput(this, "MllpNlbInternalIp1", {
      value: nlbInternalIpAddressA,
      description: "Internal IP address of the MLLP Network Load Balancer 1",
    });

    new cdk.CfnOutput(this, "MllpNlbInternalIp2", {
      value: nlbInternalIpAddressB,
      description: "Internal IP address of the MLLP Network Load Balancer 2",
    });
  }
}
