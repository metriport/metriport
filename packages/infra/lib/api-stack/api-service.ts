import { CfnOutput, Duration, StackProps } from "aws-cdk-lib";
import * as cloudwatch from "aws-cdk-lib/aws-cloudwatch";
import { Metric } from "aws-cdk-lib/aws-cloudwatch";
import { SnsAction } from "aws-cdk-lib/aws-cloudwatch-actions";
import * as dynamodb from "aws-cdk-lib/aws-dynamodb";
import * as ec2 from "aws-cdk-lib/aws-ec2";
import { Repository } from "aws-cdk-lib/aws-ecr";
import * as ecs from "aws-cdk-lib/aws-ecs";
import * as ecs_patterns from "aws-cdk-lib/aws-ecs-patterns";
import { IFunction as ILambda } from "aws-cdk-lib/aws-lambda";
import * as r53 from "aws-cdk-lib/aws-route53";
import * as r53_targets from "aws-cdk-lib/aws-route53-targets";
import * as secret from "aws-cdk-lib/aws-secretsmanager";
import { Construct } from "constructs";
import { EnvConfig } from "../../config/env-config";
import { DnsZones } from "../shared/dns";
import { Secrets } from "../shared/secrets";
import { isProd } from "../shared/util";

interface ApiServiceProps extends StackProps {
  config: EnvConfig;
  version: string | undefined;
}

// TODO move these parameters to object properties
export function createAPIService(
  stack: Construct,
  props: ApiServiceProps,
  secrets: Secrets,
  vpc: ec2.IVpc,
  dbCredsSecret: secret.ISecret,
  dynamoDBTokenTable: dynamodb.Table,
  alarmAction: SnsAction | undefined,
  dnsZones: DnsZones,
  fhirServerUrl: string | undefined,
  fhirServerQueueUrl: string | undefined,
  fhirConverterQueueUrl: string | undefined,
  fhirConverterServiceUrl: string | undefined,
  sidechainFHIRConverterQueueUrl: string | undefined,
  cdaToVisualizationLambda: ILambda,
  documentDownloaderLambda: ILambda,
  searchIngestionQueueUrl: string,
  searchEndpoint: string,
  searchAuth: { userName: string; secretName: string },
  searchIndexName: string
): {
  cluster: ecs.Cluster;
  service: ecs_patterns.NetworkLoadBalancedFargateService;
  serverAddress: string;
  loadBalancerAddress: string;
} {
  // Create a new Amazon Elastic Container Service (ECS) cluster
  const cluster = new ecs.Cluster(stack, "APICluster", { vpc, containerInsights: true });

  // Create an ECR repo where we'll deploy our Docker images to, and where ECS will pull from
  const ecrRepo = new Repository(stack, "APIRepo", {
    repositoryName: "metriport/api",
  });
  new CfnOutput(stack, "APIECRRepoURI", {
    description: "API ECR repository URI",
    value: ecrRepo.repositoryUri,
  });

  const connectWidgetUrlEnvVar =
    props.config.connectWidgetUrl != undefined
      ? props.config.connectWidgetUrl
      : `https://${props.config.connectWidget.subdomain}.${props.config.connectWidget.domain}/`;

  const searchPassword = secret.Secret.fromSecretNameV2(
    stack,
    "APISearchSecret",
    searchAuth.secretName
  );

  // Run some servers on fargate containers
  const fargateService = new ecs_patterns.NetworkLoadBalancedFargateService(
    stack,
    "APIFargateService",
    {
      cluster: cluster,
      // Watch out for the combination of vCPUs and memory, more vCPU requires more memory
      // https://docs.aws.amazon.com/AmazonECS/latest/developerguide/task_definition_parameters.html#task_size
      cpu: isProd(props.config) ? 2048 : 1024,
      desiredCount: isProd(props.config) ? 2 : 1,
      taskImageOptions: {
        image: ecs.ContainerImage.fromEcrRepository(ecrRepo, "latest"),
        containerPort: 8080,
        containerName: "API-Server",
        secrets: {
          DB_CREDS: ecs.Secret.fromSecretsManager(dbCredsSecret),
          ...secrets,
        },
        environment: {
          NODE_ENV: "production", // Determines its being run in the cloud, the logical env is set on ENV_TYPE
          ENV_TYPE: props.config.environmentType, // staging, production, sandbox
          ...(props.version ? { METRIPORT_VERSION: props.version } : undefined),
          AWS_REGION: props.config.region,
          TOKEN_TABLE_NAME: dynamoDBTokenTable.tableName,
          API_URL: `https://${props.config.subdomain}.${props.config.domain}`,
          CONNECT_WIDGET_URL: connectWidgetUrlEnvVar,
          SYSTEM_ROOT_OID: props.config.systemRootOID,
          ...props.config.commonwell,
          ...(props.config.slack ? props.config.slack : undefined),
          ...(props.config.sentryDSN ? { SENTRY_DSN: props.config.sentryDSN } : undefined),
          ...(props.config.usageReportUrl && {
            USAGE_URL: props.config.usageReportUrl,
          }),
          ...(props.config.medicalDocumentsBucketName && {
            MEDICAL_DOCUMENTS_BUCKET_NAME: props.config.medicalDocumentsBucketName,
          }),
          ...(props.config.sandboxSeedDataBucketName && {
            SANDBOX_SEED_DATA_BUCKET_NAME: props.config.sandboxSeedDataBucketName,
          }),
          CONVERT_DOC_LAMBDA_NAME: cdaToVisualizationLambda.functionName,
          DOCUMENT_DOWNLOADER_LAMBDA_NAME: documentDownloaderLambda.functionName,
          ...(fhirServerUrl && {
            FHIR_SERVER_URL: fhirServerUrl,
          }),
          ...(fhirServerQueueUrl && {
            FHIR_SERVER_QUEUE_URL: fhirServerQueueUrl,
          }),
          ...(fhirConverterQueueUrl && {
            FHIR_CONVERTER_QUEUE_URL: fhirConverterQueueUrl,
          }),
          ...(fhirConverterServiceUrl && {
            FHIR_CONVERTER_SERVER_URL: fhirConverterServiceUrl,
          }),
          ...(sidechainFHIRConverterQueueUrl && {
            SIDECHAIN_FHIR_CONVERTER_QUEUE_URL: sidechainFHIRConverterQueueUrl,
          }),
          SEARCH_INGESTION_QUEUE_URL: searchIngestionQueueUrl,
          SEARCH_ENDPOINT: searchEndpoint,
          SEARCH_USERNAME: searchAuth.userName,
          SEARCH_PASSWORD: searchPassword.secretValue.toString(),
          SEARCH_INDEX: searchIndexName,
        },
      },
      memoryLimitMiB: isProd(props.config) ? 4096 : 2048,
      healthCheckGracePeriod: Duration.seconds(60),
      publicLoadBalancer: false,
    }
  );
  const serverAddress = fargateService.loadBalancer.loadBalancerDnsName;
  const apiUrl = `${props.config.subdomain}.${props.config.domain}`;
  new r53.ARecord(stack, "APIDomainPrivateRecord", {
    recordName: apiUrl,
    zone: dnsZones.privateZone,
    target: r53.RecordTarget.fromAlias(
      new r53_targets.LoadBalancerTarget(fargateService.loadBalancer)
    ),
  });

  // Access grant for Aurora DB's secret
  dbCredsSecret.grantRead(fargateService.taskDefinition.taskRole);
  // RW grant for Dynamo DB
  dynamoDBTokenTable.grantReadWriteData(fargateService.taskDefinition.taskRole);

  cdaToVisualizationLambda.grantInvoke(fargateService.taskDefinition.taskRole);

  documentDownloaderLambda.grantInvoke(fargateService.taskDefinition.taskRole);
  // CloudWatch Alarms and Notifications

  // Allow the service to publish metrics to cloudwatch
  Metric.grantPutMetricData(fargateService.service.taskDefinition.taskRole);

  const fargateCPUAlarm = fargateService.service
    .metricCpuUtilization()
    .createAlarm(stack, "CPUAlarm", {
      threshold: 80,
      evaluationPeriods: 3,
      datapointsToAlarm: 2,
      treatMissingData: cloudwatch.TreatMissingData.NOT_BREACHING,
    });
  alarmAction && fargateCPUAlarm.addAlarmAction(alarmAction);
  alarmAction && fargateCPUAlarm.addOkAction(alarmAction);

  const fargateMemoryAlarm = fargateService.service
    .metricMemoryUtilization()
    .createAlarm(stack, "MemoryAlarm", {
      threshold: 70,
      evaluationPeriods: 3,
      datapointsToAlarm: 2,
      treatMissingData: cloudwatch.TreatMissingData.NOT_BREACHING,
    });
  alarmAction && fargateMemoryAlarm.addAlarmAction(alarmAction);
  alarmAction && fargateMemoryAlarm.addOkAction(alarmAction);

  // allow the NLB to talk to fargate
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
  fargateService.targetGroup.setAttribute("deregistration_delay.timeout_seconds", "17");

  // This also speeds up deployments so the health checks have a faster turnaround.
  // See for details: https://docs.aws.amazon.com/elasticloadbalancing/latest/network/target-group-health-checks.html
  fargateService.targetGroup.configureHealthCheck({
    healthyThresholdCount: 2,
    interval: Duration.seconds(10),
  });

  // hookup autoscaling based on 90% thresholds
  const scaling = fargateService.service.autoScaleTaskCount({
    minCapacity: isProd(props.config) ? 2 : 1,
    maxCapacity: isProd(props.config) ? 10 : 2,
  });
  scaling.scaleOnCpuUtilization("autoscale_cpu", {
    targetUtilizationPercent: 90,
    scaleInCooldown: Duration.minutes(2),
    scaleOutCooldown: Duration.seconds(30),
  });
  scaling.scaleOnMemoryUtilization("autoscale_mem", {
    targetUtilizationPercent: 90,
    scaleInCooldown: Duration.minutes(2),
    scaleOutCooldown: Duration.seconds(30),
  });

  return {
    cluster,
    service: fargateService,
    serverAddress: apiUrl,
    loadBalancerAddress: serverAddress,
  };
}
