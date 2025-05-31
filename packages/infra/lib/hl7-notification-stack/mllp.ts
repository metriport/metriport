import * as cdk from "aws-cdk-lib";
import { Duration } from "aws-cdk-lib";
import * as ec2 from "aws-cdk-lib/aws-ec2";
import { Repository } from "aws-cdk-lib/aws-ecr";
import * as ecs from "aws-cdk-lib/aws-ecs";
import * as elbv2 from "aws-cdk-lib/aws-elasticloadbalancingv2";
import * as iam from "aws-cdk-lib/aws-iam";
import * as logs from "aws-cdk-lib/aws-logs";
import { LogGroup } from "aws-cdk-lib/aws-logs";
import * as s3 from "aws-cdk-lib/aws-s3";
import { Construct } from "constructs";
import { EnvConfigNonSandbox } from "../../config/env-config";
import { buildSecrets, secretsToECS } from "../shared/secrets";
import {
  MLLP_DEFAULT_PORT,
  MLLP_SERVER_NLB_PROD_INTERNAL_IP_A,
  MLLP_SERVER_NLB_PROD_INTERNAL_IP_B,
  MLLP_SERVER_NLB_STAGING_INTERNAL_IP_A,
  MLLP_SERVER_NLB_STAGING_INTERNAL_IP_B,
} from "./constants";

interface MllpStackProps extends cdk.StackProps {
  config: EnvConfigNonSandbox;
  version: string | undefined;
  vpc: ec2.Vpc;
  ecrRepo: Repository;
  incomingHl7NotificationBucket: s3.IBucket;
}

const setupNlb = (identifier: string, vpc: ec2.Vpc, nlb: elbv2.NetworkLoadBalancer, ip: string) => {
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

  const listener = nlb.addListener(`MllpListener${identifier}`, {
    port: MLLP_DEFAULT_PORT,
  });

  const targetGroup = listener.addTargets(`MllpTargets${identifier}`, {
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

  return targetGroup;
};

export class MllpStack extends cdk.NestedStack {
  constructor(scope: Construct, id: string, props: MllpStackProps) {
    super(scope, id, props);

    const { vpc, ecrRepo, incomingHl7NotificationBucket, config } = props;
    const { notificationWebhookSenderQueue } = config.hl7Notification;
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
        MLLP_PORT: MLLP_DEFAULT_PORT.toString(),
        HL7_INCOMING_MESSAGE_BUCKET_NAME: incomingHl7NotificationBucket.bucketName,
        HL7_NOTIFICATION_QUEUE_URL: notificationWebhookSenderQueue.url,
        ...(props.version ? { RELEASE_SHA: props.version } : undefined),
      },
      portMappings: [{ containerPort: MLLP_DEFAULT_PORT }],
      logging: ecs.LogDriver.awsLogs({
        logGroup,
        streamPrefix: "mllp-server",
      }),
    });

    let nlb1Ip: string;
    let nlb2Ip: string;
    if (config.environmentType === "production") {
      nlb1Ip = MLLP_SERVER_NLB_PROD_INTERNAL_IP_A;
      nlb2Ip = MLLP_SERVER_NLB_PROD_INTERNAL_IP_B;
    } else if (config.environmentType === "staging") {
      nlb1Ip = MLLP_SERVER_NLB_STAGING_INTERNAL_IP_A;
      nlb2Ip = MLLP_SERVER_NLB_STAGING_INTERNAL_IP_B;
    } else {
      throw new Error(`Invalid environment type for MllpStack: ${config.environmentType}`);
    }

    /**
     * We're using an empty string for the first setupNlb call to maintain identifiers and
     * avoid having to recreate a new listener and target group for the existing NLB.
     */
    setupNlb("", vpc, nlbA, nlb1Ip).addTarget(fargateService);
    setupNlb("B", vpc, nlbB, nlb2Ip).addTarget(fargateService);
    incomingHl7NotificationBucket.grantWrite(fargateService.taskDefinition.taskRole);

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
      value: nlbA.loadBalancerDnsName,
      description: "DNS name of the Network Load Balancer for MLLP",
    });

    new cdk.CfnOutput(this, "MllpNlbDnsNameB", {
      value: nlbB.loadBalancerDnsName,
      description: "DNS name of the Network Load Balancer for MLLP B",
    });

    new cdk.CfnOutput(this, "MllpNlbInternalIpA", {
      value: MLLP_SERVER_NLB_PROD_INTERNAL_IP_A,
      description: "Internal IP address of the MLLP Network Load Balancer A",
    });

    new cdk.CfnOutput(this, "MllpNlbInternalIpB", {
      value: MLLP_SERVER_NLB_PROD_INTERNAL_IP_B,
      description: "Internal IP address of the MLLP Network Load Balancer B",
    });
  }
}
