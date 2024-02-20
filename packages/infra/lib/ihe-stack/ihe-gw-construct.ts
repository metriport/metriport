import { CfnOutput, Duration } from "aws-cdk-lib";
import { Certificate, CertificateValidation } from "aws-cdk-lib/aws-certificatemanager";
import { SnsAction } from "aws-cdk-lib/aws-cloudwatch-actions";
import * as ec2 from "aws-cdk-lib/aws-ec2";
import { SecurityGroup } from "aws-cdk-lib/aws-ec2";
import * as ecr from "aws-cdk-lib/aws-ecr";
import * as ecs from "aws-cdk-lib/aws-ecs";
import { FargateTaskDefinition } from "aws-cdk-lib/aws-ecs";
import { ApplicationLoadBalancedTaskImageOptions } from "aws-cdk-lib/aws-ecs-patterns";
import {
  ApplicationLoadBalancer,
  ApplicationProtocol,
  HealthCheck,
  Protocol,
} from "aws-cdk-lib/aws-elasticloadbalancingv2";
import { Function as Lambda } from "aws-cdk-lib/aws-lambda";
import * as r53 from "aws-cdk-lib/aws-route53";
import * as r53_targets from "aws-cdk-lib/aws-route53-targets";
import { IBucket } from "aws-cdk-lib/aws-s3";
import { Construct } from "constructs";
import { EnvConfig } from "../../config/env-config";
import { IHEGatewayProps } from "../../config/ihe-gateway-config";
import { ecrRepoName } from "../ihe-prereq-stack";
import { getLambdaUrl as getLambdaUrlShared } from "../shared/lambda";
import IHEDBConstruct from "./ihe-db-construct";

export interface IHEGatewayConstructProps {
  mainConfig: EnvConfig;
  config: IHEGatewayProps;
  cluster: ecs.Cluster;
  vpc: ec2.IVpc;
  // TODO 1377 Implement this
  // alarmThresholds?: IHEGatewayAlarmThresholds;
  privateZone: r53.IPrivateHostedZone;
  db: IHEDBConstruct;
  alarmAction?: SnsAction | undefined;
  documentQueryLambda: Lambda;
  documentRetrievalLambda: Lambda;
  patientDiscoveryLambda: Lambda;
  medicalDocumentsBucket: IBucket;
  name: string;
  dnsSubdomain: string;
  httpPorts: number[];
}

const maxPortsPerLB = 5;
const defaultPorts = [8080, 8443];
const maxPortsOnProps = maxPortsPerLB - defaultPorts.length;

export default class IHEGatewayConstruct extends Construct {
  public readonly server: ecs.IFargateService;
  public readonly serverAddress: string;

  constructor(scope: Construct, props: IHEGatewayConstructProps) {
    super(scope, `${props.name}Construct`);

    const {
      vpc,
      mainConfig,
      config,
      cluster,
      privateZone,
      db,
      documentQueryLambda,
      documentRetrievalLambda,
      patientDiscoveryLambda,
      medicalDocumentsBucket,
      name,
      dnsSubdomain,
      httpPorts,
    } = props;
    const id = name;
    const dbAddress = db.server.clusterEndpoint.socketAddress;
    const dbIdentifier = config.rds.dbName;

    if (httpPorts.length > maxPortsOnProps) {
      throw new Error(`This construct can have at most ${maxPortsOnProps} HTTP ports`);
    }

    const getLambdaUrl = (arn: string) => {
      return getLambdaUrlShared({ region: mainConfig.region, arn });
    };

    const secrets: ApplicationLoadBalancedTaskImageOptions["secrets"] = {
      DATABASE_PASSWORD: ecs.Secret.fromSecretsManager(db.secret),
    };
    const environment: ApplicationLoadBalancedTaskImageOptions["environment"] = {
      DATABASE: `postgres`,
      DATABASE_URL: `jdbc:postgresql://${dbAddress}/${dbIdentifier}`,
      DATABASE_USERNAME: config.rds.userName,
      INBOUND_PATIENT_DISCOVERY_URL: getLambdaUrl(patientDiscoveryLambda.functionArn),
      INBOUND_DOCUMENT_QUERY_URL: getLambdaUrl(documentQueryLambda.functionArn),
      INBOUND_DOCUMENT_RETRIEVAL_URL: getLambdaUrl(documentRetrievalLambda.functionArn),
      S3_BUCKET_NAME: medicalDocumentsBucket.bucketName,
      HOME_COMMUNITY_ID: mainConfig.systemRootOID,
      HOME_COMMUNITY_NAME: mainConfig.systemRootOrgName,
      VMOPTIONS: `-Xms${config.java.initialHeapSize},-Xmx${config.java.maxHeapSize}`,
    };

    const ecrRepo = ecr.Repository.fromRepositoryName(scope, `${id}EcrRepo`, ecrRepoName);

    const image = ecs.ContainerImage.fromEcrRepository(ecrRepo, "latest");

    const healthCheck: HealthCheck = {
      healthyThresholdCount: 2,
      unhealthyThresholdCount: 3,
      interval: Duration.seconds(10),
      path: "/",
      port: "8080",
      protocol: Protocol.HTTP,
      timeout: Duration.seconds(5),
    };
    const taskDefinition = new FargateTaskDefinition(this, `${id}TaskDefinition`, {
      cpu: config.ecs.cpu,
      memoryLimitMiB: config.ecs.memory,
      runtimePlatform: {
        cpuArchitecture: ecs.CpuArchitecture.X86_64,
        operatingSystemFamily: ecs.OperatingSystemFamily.LINUX,
      },
    });
    const containerName = `${id}-Server`;
    taskDefinition.addContainer(containerName, {
      image,
      containerName,
      secrets,
      environment,
      portMappings: [...defaultPorts, ...httpPorts].map(port => ({
        containerPort: port,
        hostPort: port,
        protocol: ecs.Protocol.TCP,
      })),
    });

    const alb = new ApplicationLoadBalancer(scope, `${id}ALB`, {
      vpc,
      internetFacing: false,
    });

    const service = new ecs.FargateService(scope, `${id}FargateService`, {
      cluster,
      taskDefinition,
      desiredCount: config.ecs.minCapacity,
    });

    const fargateService = { service, taskDefinition };
    const lbTargets: ecs.EcsTarget[] = [];

    const url = `${dnsSubdomain}.${props.config.subdomain}.${mainConfig.domain}`;

    const httpsCert = new Certificate(this, `${id}HTTPSCertificate`, {
      validation: CertificateValidation.fromDns(privateZone),
      domainName: url,
    });

    const addPortToLB = (port: number, theLB: ApplicationLoadBalancer) => {
      const isHttps = port === 443 || port === 8443;
      const protocol = isHttps ? ApplicationProtocol.HTTPS : ApplicationProtocol.HTTP;
      const certificates = isHttps ? [httpsCert] : undefined;
      const listener = theLB.addListener(`${id}Listener_${port}`, {
        open: false,
        port,
        protocol,
        certificates,
      });
      const targetGroupId = `${id}-TG-${port}`;
      service.registerLoadBalancerTargets({
        containerName,
        containerPort: port,
        protocol: ecs.Protocol.TCP,
        newTargetGroupId: targetGroupId,
        listener: ecs.ListenerConfig.applicationListener(listener, {
          protocol: ApplicationProtocol.HTTP,
          port,
          targetGroupName: targetGroupId,
          healthCheck,
        }),
      });
    };
    [...defaultPorts, ...httpPorts].forEach(port => addPortToLB(port, alb));
    service.registerLoadBalancerTargets(...lbTargets);

    this.server = fargateService.service;
    this.serverAddress = alb.loadBalancerDnsName;

    new r53.ARecord(this, `${id}PrivateRecord`, {
      recordName: url,
      zone: privateZone,
      target: r53.RecordTarget.fromAlias(new r53_targets.LoadBalancerTarget(alb)),
    });

    const lbSGId = `${id}_LB_SG`;
    const sg = new SecurityGroup(this, lbSGId, {
      allowAllOutbound: true,
      securityGroupName: lbSGId,
      vpc,
    });
    sg.addIngressRule(
      ec2.Peer.ipv4(vpc.vpcCidrBlock),
      ec2.Port.allTraffic(),
      "Allow traffic from within the VPC to the LB"
    );
    alb.addSecurityGroup(sg);

    // allow the LB to talk to fargate
    fargateService.service.connections.allowFrom(
      ec2.Peer.ipv4(vpc.vpcCidrBlock),
      ec2.Port.allTraffic(),
      "Allow traffic from within the VPC to the service secure port"
    );

    // TODO: #489 ain't the most secure, but the above code doesn't work as CDK complains we can't use the connections
    // from the cluster created above, should be fine for now as it will only accept connections in the VPC
    fargateService.service.connections.allowFromAnyIpv4(ec2.Port.allTcp());

    // TODO 1377 try to remove this
    // TODO: #489 ain't the most secure, but the above code doesn't work as CDK complains we can't use the connections
    // from the cluster created above, should be fine for now as it will only accept connections in the VPC
    // fargateService.service.connections.allowFromAnyIpv4(ec2.Port.allTcp());

    // This speeds up deployments so the tasks are swapped quicker.
    // See for details: https://docs.aws.amazon.com/elasticloadbalancing/latest/application/load-balancer-target-groups.html#deregistration-delay
    // fargateService.targetGroup.setAttribute("deregistration_delay.timeout_seconds", "17");

    // hookup autoscaling based on 90% thresholds
    const scaling = fargateService.service.autoScaleTaskCount({
      minCapacity: config.ecs.minCapacity,
      maxCapacity: config.ecs.maxCapacity,
    });
    scaling.scaleOnCpuUtilization(`${id}AutoscaleCPU`, {
      targetUtilizationPercent: 90,
      scaleInCooldown: Duration.minutes(2),
      scaleOutCooldown: Duration.seconds(30),
    });
    scaling.scaleOnMemoryUtilization(`${id}AutoscaleMEM`, {
      targetUtilizationPercent: 90,
      scaleInCooldown: Duration.minutes(2),
      scaleOutCooldown: Duration.seconds(30),
    });

    // Grant access for the service
    db.server.connections.allowDefaultPortFrom(fargateService.service);
    db.secret.grantRead(fargateService.taskDefinition.taskRole);
    documentQueryLambda.grantInvoke(fargateService.taskDefinition.taskRole);
    documentRetrievalLambda.grantInvoke(fargateService.taskDefinition.taskRole);
    patientDiscoveryLambda.grantInvoke(fargateService.taskDefinition.taskRole);
    medicalDocumentsBucket.grantReadWrite(fargateService.taskDefinition.taskRole);

    // TODO 1377 Implement this
    // this.createAlarms(id, props.alarmThresholds);

    new CfnOutput(this, `${id}FargateServiceARN`, {
      value: fargateService.service.serviceArn,
    });
    new CfnOutput(this, `${id}ECSClusterARN`, {
      value: cluster.clusterArn,
    });
  }

  // private createAlarms(
  //   id: string,
  //   {
  //     statusRed,
  //     statusYellow,
  //     freeStorageMB,
  //     masterCpuUtilization,
  //     cpuUtilization,
  //     jvmMemoryPressure,
  //     searchLatency,
  //   }: IHEGatewayAlarmThresholds = {}
  // ) {
  //   const createAlarm = ({
  //     metric,
  //     name,
  //     threshold,
  //     evaluationPeriods,
  //     comparisonOperator,
  //   }: {
  //     metric: Metric;
  //     name: string;
  //     threshold: number;
  //     evaluationPeriods: number;
  //     comparisonOperator?: ComparisonOperator;
  //   }) => {
  //     metric.createAlarm(this, `${id}${name}`, {
  //       threshold,
  //       evaluationPeriods,
  //       alarmName: `${id}${name}`,
  //       comparisonOperator,
  //     });
  //   };

  //   (statusRed == null || statusRed) &&
  //     createAlarm({
  //       metric: this.domain.metricClusterStatusRed(),
  //       name: "ClusterStatusRed",
  //       threshold: 1,
  //       evaluationPeriods: 1,
  //     });
  //   (statusYellow == null || statusYellow) &&
  //     createAlarm({
  //       metric: this.domain.metricClusterStatusYellow(),
  //       name: "ClusterStatusYellow",
  //       threshold: 1,
  //       evaluationPeriods: 3,
  //     });

  //   createAlarm({
  //     metric: this.domain.metricFreeStorageSpace(),
  //     name: "FreeStorage",
  //     threshold: freeStorageMB ?? 5_000,
  //     evaluationPeriods: 1,
  //     comparisonOperator: ComparisonOperator.LESS_THAN_THRESHOLD,
  //   });

  //   createAlarm({
  //     metric: this.domain.metricMasterCPUUtilization(),
  //     name: "MasterCPUUtilization",
  //     threshold: masterCpuUtilization ?? 90,
  //     evaluationPeriods: 3,
  //   });
  //   createAlarm({
  //     metric: this.domain.metricCPUUtilization(),
  //     name: "CPUUtilization",
  //     threshold: cpuUtilization ?? 90,
  //     evaluationPeriods: 3,
  //   });

  //   createAlarm({
  //     metric: this.domain.metricJVMMemoryPressure(),
  //     name: "JVMMemoryPressure",
  //     threshold: jvmMemoryPressure ?? 90,
  //     evaluationPeriods: 3,
  //   });
  //   createAlarm({
  //     metric: this.domain.metricSearchLatency(),
  //     name: "SearchLatency",
  //     threshold: searchLatency ?? 300,
  //     evaluationPeriods: 1,
  //   });
  // }
}
