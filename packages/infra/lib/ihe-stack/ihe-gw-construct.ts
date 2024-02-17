import { CfnOutput, Duration } from "aws-cdk-lib";
import { SnsAction } from "aws-cdk-lib/aws-cloudwatch-actions";
import * as ec2 from "aws-cdk-lib/aws-ec2";
import { SecurityGroup } from "aws-cdk-lib/aws-ec2";
import * as ecr from "aws-cdk-lib/aws-ecr";
import * as ecs from "aws-cdk-lib/aws-ecs";
import * as ecs_patterns from "aws-cdk-lib/aws-ecs-patterns";
import { ApplicationLoadBalancedTaskImageOptions } from "aws-cdk-lib/aws-ecs-patterns";
import {
  ApplicationLoadBalancer,
  ApplicationProtocol,
  ApplicationTargetGroup,
  HealthCheck,
  Protocol,
  TargetType,
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
import { isProd } from "../shared/util";
import IHEDBConstruct from "./ihe-db-construct";
// import * as elasticloadbalancingv2 from "@aws-cdk/aws-elasticloadbalancingv2";
//     import * as elasticloadbalancingv2targets from "@aws-cdk/aws-elasticloadbalancingv2-targets";

export interface IHEGatewayConstructProps {
  mainConfig: EnvConfig;
  config: IHEGatewayProps;
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
}

const maxPortsPerLB = 5;

const id = "IHEGateway";

// TODO 1377 Figure this out and enable the remaining ports. Might need to create 2-3 LBs: "UpdateService error: load balancers can have at most 5 items"
// const mainPort = 8443;
const httpPorts = [
  // 8081, 8082, 8083, 8084, 8085, 8086, 9091, 9092, 8100, 23067, 16850, 16852, 16853,
  // 8081, 8082, 8083, 8084, 8085, 8086, 9091, 9092,
  // 8443, 8081, 8082, 8083, 8084, 8085, 8086, 9091, 9092,
  8081, 8082, 8083,
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
      medicalDocumentsBucket,
    } = props;
    const dbAddress = db.server.clusterEndpoint.socketAddress;
    const dbIdentifier = config.rds.dbName;

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

    const containerInsights = isProd(mainConfig) ? true : false;
    const cluster = new ecs.Cluster(scope, `${id}Cluster`, { vpc, containerInsights });

    const ecrRepo = ecr.Repository.fromRepositoryName(scope, "IHE-GW-ECR-Repo", ecrRepoName);

    const image = ecs.ContainerImage.fromEcrRepository(ecrRepo, "latest");

    // const httpsCert = new Certificate(this, `${id}HTTPSCertificate`, {
    //   domainName: `${config.subdomain}.${mainConfig.domain}`,
    //   validation: CertificateValidation.fromDns(privateZone),
    // });

    // Why ALB:
    // - https://github.com/metriport/metriport-internal/issues/738
    //   NLB: max 350s - https://docs.aws.amazon.com/elasticloadbalancing/latest/network/network-load-balancers.html#connection-idle-timeout
    //   ALB: max 4,000s - https://docs.aws.amazon.com/elasticloadbalancing/latest/application/application-load-balancers.html#connection-idle-timeout
    // - https://aws.amazon.com/elasticloadbalancing/features/
    // - https://docs.aws.amazon.com/AmazonECS/latest/developerguide/load-balancer-types.html
    const containerName = `${id}-Server`;
    // const containerPorts = [8080, mainPort, ...additionalHTTPPorts];
    // maxPortsPerLB - 1 because 8080 is added to the main container regardless
    const portsOnMainContainer = maxPortsPerLB - 1;
    const mainContainerPorts = httpPorts.slice(0, portsOnMainContainer);
    const additionalContainerPorts =
      httpPorts.length > portsOnMainContainer ? httpPorts.slice(portsOnMainContainer) : [];
    const serviceId = `${id}FargateService`;

    // TODO 1377 1st attempt
    // const fargateService = new ecs_patterns.ApplicationLoadBalancedFargateService(this, serviceId, {
    //   serviceName: serviceId,
    //   cluster: cluster,
    //   memoryLimitMiB: config.ecs.memory,
    //   cpu: config.ecs.cpu,
    //   desiredCount: config.ecs.minCapacity,
    //   taskImageOptions: {
    //     image,
    //     containerPort: 8080,
    //     containerName,
    //     secrets,
    //     environment,
    //   },
    //   // targetGroups: [8080, mainPort, ...additionalHTTPPorts].map(port => ({
    //   //   containerPort: port,
    //   //   protocol: Protocol.TCP,
    //   // })),
    //   publicLoadBalancer: false,
    //   healthCheckGracePeriod: Duration.seconds(60),
    //   runtimePlatform: {
    //     cpuArchitecture: ecs.CpuArchitecture.X86_64,
    //     operatingSystemFamily: ecs.OperatingSystemFamily.LINUX,
    //   },
    // });

    // TODO 1377 2nd/3rd attempts
    const fargateService = new ecs_patterns.ApplicationMultipleTargetGroupsFargateService(
      this,
      serviceId,
      {
        serviceName: serviceId,
        cluster: cluster,
        memoryLimitMiB: config.ecs.memory,
        cpu: config.ecs.cpu,
        desiredCount: config.ecs.minCapacity,
        taskImageOptions: {
          image,
          containerPorts: [8080, ...httpPorts],
          containerName,
          secrets,
          environment,
        },
        // loadBalancers: [
        //   {
        //     name: `${id}_LB`,
        //     publicLoadBalancer: false,
        //     listeners: httpPorts.map(port => ({
        //       name: `${id}_LB_Listener_${port}`,
        //       port,
        //       protocol: ApplicationProtocol.HTTP,
        //     })),
        //   },
        // ],
        assignPublicIp: false,
        healthCheckGracePeriod: Duration.seconds(60),
        runtimePlatform: {
          cpuArchitecture: ecs.CpuArchitecture.X86_64,
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

    // fargateService.targetGroups.forEach(tg => {
    //   tg.firstLoadBalancerFullName;
    // });
    // fargateService.loadBalancers.forEach(lb => {
    //   lb.listeners.forEach(listener => {
    //     if (listener.toString().includes("HTTPS")) {
    //       const httpsCert = new Certificate(this, `${id}HTTPSCertificate_${listener.listenerArn}`, {
    //         domainName: fargateService.loadBalancer.loadBalancerDnsName,
    //         validation: CertificateValidation.fromDns(privateZone),
    //       });
    //       listener.addCertificates(`${id}HTTPSCertificateListener_${listener.listenerArn}`, [
    //         httpsCert,
    //       ]);
    //     }
    //   });
    // });

    const healthCheck: HealthCheck = {
      healthyThresholdCount: 2,
      unhealthyThresholdCount: 3,
      interval: Duration.seconds(10),
      path: "/",
      port: "8080",
      protocol: Protocol.HTTP,
      timeout: Duration.seconds(5),
    };
    // const tgs = [fargateService.targetGroup];
    const tgs = fargateService.targetGroups;
    tgs.forEach(tg => tg.configureHealthCheck(healthCheck));

    const lb = fargateService.loadBalancer;
    // const lbs = [lb];
    const lbs = fargateService.loadBalancers;
    console.log(`>>> Got ${lbs.length} LBs from the fargate service`);
    let lbCount = 0;
    lbs.forEach(lb => {
      const lbSGId = `${id}_LB_SG_Out${lbCount++}`;
      lb.addSecurityGroup(
        new SecurityGroup(this, lbSGId, {
          allowAllOutbound: true,
          securityGroupName: lbSGId,
          vpc,
        })
      );
    });
    // lb.setAttribute("scheme", "internal");

    // TODO 1377 Add this to support HTTPS/8443
    // const httpsCert = new Certificate(this, `${id}HTTPSCertificate`, {
    //   domainName: `${config.subdomain}.${mainConfig.domain}`,
    //   subjectAlternativeNames: [lb.loadBalancerDnsName],
    //   validation: CertificateValidation.fromDns(privateZone),
    // });

    const addPortToLB = (port: number, lb: ApplicationLoadBalancer) => {
      // fargateService.taskDefinition.defaultContainer?.addPortMappings({
      //   containerPort: port,
      // });
      const isHttps = port === 443 || port === 8443;
      if (isHttps) return;
      const protocol = isHttps ? ApplicationProtocol.HTTPS : ApplicationProtocol.HTTP;
      // const certificates = isHttps ? [httpsCert] : undefined;
      const tg = new ApplicationTargetGroup(this, `${id}TargetGroup_${port}`, {
        healthCheck,
        port,
        protocol,
        targetType: TargetType.IP,
        targets: [
          fargateService.service.loadBalancerTarget({ containerName, containerPort: port }),
        ],
        vpc,
      });
      lb.addListener(`${id}_LB_Listener_${port}`, {
        port,
        protocol,
        // certificates,
        // defaultAction: ListenerAction.forward([tg]),
        defaultTargetGroups: [tg],
      });
    };

    mainContainerPorts.forEach(port => {
      console.log(`Adding port ${port} to the MAIN LB`);
      addPortToLB(port, lb);
    });

    // 1377 make this more dynamic, create one for each 5 ports
    // const newLB = new ApplicationLoadBalancer(this, `${id}LB_Alt`, {
    //   vpc,
    //   internetFacing: false,
    // });
    // newLB.listeners.forEach(listener => {
    //   listener.addTargets(`${id}LB_Alt_Targets`, {
    //     port: 8080,
    //     protocol: ApplicationProtocol.HTTP,
    //     targets: [fa])
    additionalContainerPorts.forEach(port => {
      console.log(`Adding port ${port} to the alt LB`);
      // addPortToLB(port, newLB);
      addPortToLB(port, lb);
    });

    // allow the LB to talk to fargate
    fargateService.service.connections.allowFrom(
      ec2.Peer.ipv4(vpc.vpcCidrBlock),
      ec2.Port.allTraffic(),
      "Allow traffic from within the VPC to the service secure port"
    );
    // TODO 1377 try to remove this
    // TODO: #489 ain't the most secure, but the above code doesn't work as CDK complains we can't use the connections
    // from the cluster created above, should be fine for now as it will only accept connections in the VPC
    fargateService.service.connections.allowFromAnyIpv4(ec2.Port.allTcp());

    // This speeds up deployments so the tasks are swapped quicker.
    // See for details: https://docs.aws.amazon.com/elasticloadbalancing/latest/application/load-balancer-target-groups.html#deregistration-delay
    fargateService.targetGroup.setAttribute("deregistration_delay.timeout_seconds", "17");

    // TODO 1337 try to avoid this, then remove it
    // fargateService.targetGroup.configureHealthCheck({
    //   healthyThresholdCount: 2,
    //   unhealthyThresholdCount: 3,
    //   interval: Duration.seconds(10),
    //   path: "/",
    //   // port: mainPort.toString(),
    //   // protocol: Protocol.HTTPS,
    //   port: "8080",
    //   protocol: Protocol.HTTP,
    //   timeout: Duration.seconds(5),
    // });

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
