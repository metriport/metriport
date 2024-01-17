import { CfnOutput, Duration } from "aws-cdk-lib";
import * as acm from "aws-cdk-lib/aws-certificatemanager";
import { SnsAction } from "aws-cdk-lib/aws-cloudwatch-actions";
import * as ec2 from "aws-cdk-lib/aws-ec2";
import * as ecr_assets from "aws-cdk-lib/aws-ecr-assets";
import * as ecs from "aws-cdk-lib/aws-ecs";
import * as ecs_patterns from "aws-cdk-lib/aws-ecs-patterns";
import { ApplicationProtocol, Protocol } from "aws-cdk-lib/aws-elasticloadbalancingv2";
import { Function as Lambda } from "aws-cdk-lib/aws-lambda";
import * as r53 from "aws-cdk-lib/aws-route53";
import * as r53_targets from "aws-cdk-lib/aws-route53-targets";
import { Construct } from "constructs";
import { EnvConfig } from "../../config/env-config";
import { IHEGatewayProps } from "../../config/ihe-gateway-config";
import { isProd } from "../shared/util";
import IHEDBConstruct from "./ihe-db-construct";

// export interface IHEGatewayAlarmThresholds {
//   masterCpuUtilization?: number;
//   cpuUtilization?: number;
// }
export interface IHEGatewayConstructProps {
  mainConfig: EnvConfig;
  config: IHEGatewayProps;
  vpc: ec2.IVpc;
  // alarmThresholds?: IHEGatewayAlarmThresholds;
  privateZone: r53.IPrivateHostedZone;
  db: IHEDBConstruct;
  alarmAction?: SnsAction | undefined;
  documentQueryLambda: Lambda;
  documentRetrievalLambda: Lambda;
  patientDiscoveryLambda: Lambda;
}

const id = "IHEGateway";

const mainPort = 8443;
const additionalHTTPPorts = [
  8081, 8082, 8083, 8084, 8085, 8086, 9091, 9092, 8100, 23067, 16850, 16852, 16853,
];

export default class IHEGatewayConstruct extends Construct {
  public readonly server: ecs.IFargateService;
  public readonly serverAddress: string;

  constructor(scope: Construct, props: IHEGatewayConstructProps) {
    super(scope, `${id}Construct`);

    const {
      vpc,
      mainConfig,
      config,
      privateZone,
      db,
      documentQueryLambda,
      documentRetrievalLambda,
      patientDiscoveryLambda,
    } = props;
    const dbAddress = db.server.clusterEndpoint.socketAddress;
    const dbIdentifier = db.server.clusterIdentifier;

    const containerInsights = isProd(mainConfig) ? true : false;
    const cluster = new ecs.Cluster(scope, `${id}Cluster`, { vpc, containerInsights });

    const dockerImage = new ecr_assets.DockerImageAsset(this, `${id}DockerImage`, {
      directory: "../ihe-gateway",
    });

    // Why ALB:
    // - https://github.com/metriport/metriport-internal/issues/738
    //   NLB: max 350s - https://docs.aws.amazon.com/elasticloadbalancing/latest/network/network-load-balancers.html#connection-idle-timeout
    //   ALB: max 4,000s - https://docs.aws.amazon.com/elasticloadbalancing/latest/application/application-load-balancers.html#connection-idle-timeout
    // - https://aws.amazon.com/elasticloadbalancing/features/
    // - https://docs.aws.amazon.com/AmazonECS/latest/developerguide/load-balancer-types.html
    const fargateService = new ecs_patterns.ApplicationLoadBalancedFargateService(
      this,
      `${id}FargateService`,
      {
        cluster: cluster,
        memoryLimitMiB: config.ecs.memory,
        cpu: config.ecs.cpu,
        desiredCount: config.ecs.minCapacity,
        taskImageOptions: {
          image: ecs.ContainerImage.fromDockerImageAsset(dockerImage),
          containerPort: 8080,
          // containerPort: mainPort,
          // certificate: httpsCert,
          containerName: `${id}-Server`,
          secrets: {
            DATABASE_PASSWORD: ecs.Secret.fromSecretsManager(db.secret),
          },
          environment: {
            DATABASE_URL: `jdbc:postgresql://${dbAddress}/${dbIdentifier}`,
            DATABASE_USERNAME: config.rds.userName,
            LAMBDA_PATIENT_DISCOVERY_ARN: patientDiscoveryLambda.functionArn,
            LAMBDA_DOCUMENT_QUERY_ARN: documentQueryLambda.functionArn,
            LAMBDA_DOCUMENT_RETRIEVE_ARN: documentRetrievalLambda.functionArn,
          },
        },
        healthCheckGracePeriod: Duration.seconds(60),
        publicLoadBalancer: false,
        idleTimeout: config.ecs.maxRequestTimeout,
        runtimePlatform: {
          cpuArchitecture: ecs.CpuArchitecture.ARM64,
          operatingSystemFamily: ecs.OperatingSystemFamily.LINUX,
        },
      }
    );
    this.server = fargateService.service;
    this.serverAddress = fargateService.loadBalancer.loadBalancerDnsName;

    const apiUrl = `${props.config.subdomain}.${mainConfig.domain}`;
    new r53.ARecord(this, `${id}PrivateRecord`, {
      recordName: apiUrl,
      zone: privateZone,
      target: r53.RecordTarget.fromAlias(
        new r53_targets.LoadBalancerTarget(fargateService.loadBalancer)
      ),
    });

    // Additional LB listeners
    const httpsCert = new acm.Certificate(this, `${id}HTTPSCertificate`, {
      domainName: `${config.subdomain}.${mainConfig.domain}`,
      validation: acm.CertificateValidation.fromDns(privateZone),
    });
    fargateService.loadBalancer.addListener(`${id}HTTPSListener`, {
      port: 443,
      protocol: ApplicationProtocol.HTTPS,
      certificates: [httpsCert],
    });
    additionalHTTPPorts.forEach(port => {
      fargateService.loadBalancer.addListener(`${id}Listener_${port}`, {
        port,
        protocol: ApplicationProtocol.HTTP,
      });
    });

    // allow the LB to talk to fargate
    fargateService.service.connections.allowFrom(
      ec2.Peer.ipv4(vpc.vpcCidrBlock),
      ec2.Port.allTraffic(),
      "Allow traffic from within the VPC to the service secure port"
    );
    // TODO: #489 ain't the most secure, but the above code doesn't work as CDK complains we can't use the connections
    // from the cluster created above, should be fine for now as it will only accept connections in the VPC
    fargateService.service.connections.allowFromAnyIpv4(ec2.Port.allTcp());

    // This speeds up deployments so the tasks are swapped quicker.
    // See for details: https://docs.aws.amazon.com/elasticloadbalancing/latest/application/load-balancer-target-groups.html#deregistration-delay
    // fargateService.targetGroup.setAttribute("deregistration_delay.timeout_seconds", "17");

    // This also speeds up deployments so the health checks have a faster turnaround.
    // See for details: https://docs.aws.amazon.com/elasticloadbalancing/latest/network/target-group-health-checks.html
    // fargateService.targetGroup.configureHealthCheck({
    //   healthyThresholdCount: 2,
    //   interval: Duration.seconds(10),
    // });
    fargateService.targetGroup.configureHealthCheck({
      healthyThresholdCount: 2,
      interval: Duration.seconds(30),
      path: "/",
      port: `${mainPort}`,
      protocol: Protocol.HTTPS,
    });

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
    db.secret.grantRead(fargateService.taskDefinition.taskRole);
    documentQueryLambda.grantInvoke(fargateService.taskDefinition.taskRole);
    documentRetrievalLambda.grantInvoke(fargateService.taskDefinition.taskRole);
    patientDiscoveryLambda.grantInvoke(fargateService.taskDefinition.taskRole);

    // TODO 1377 Implement this
    // TODO 1377 Implement this
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
