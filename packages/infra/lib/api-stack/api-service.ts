import { CfnOutput, Duration, StackProps } from "aws-cdk-lib";
import * as cloudwatch from "aws-cdk-lib/aws-cloudwatch";
import { Metric } from "aws-cdk-lib/aws-cloudwatch";
import { SnsAction } from "aws-cdk-lib/aws-cloudwatch-actions";
import * as dynamodb from "aws-cdk-lib/aws-dynamodb";
import * as ec2 from "aws-cdk-lib/aws-ec2";
import { Repository } from "aws-cdk-lib/aws-ecr";
import * as ecs from "aws-cdk-lib/aws-ecs";
import * as ecs_patterns from "aws-cdk-lib/aws-ecs-patterns";
import {
  ApplicationProtocol,
  NetworkLoadBalancer,
  NetworkTargetGroup,
  Protocol,
} from "aws-cdk-lib/aws-elasticloadbalancingv2";
import { AlbTarget } from "aws-cdk-lib/aws-elasticloadbalancingv2-targets";
import * as iam from "aws-cdk-lib/aws-iam";
import { IFunction as ILambda } from "aws-cdk-lib/aws-lambda";
import { LogGroup } from "aws-cdk-lib/aws-logs";
import * as rds from "aws-cdk-lib/aws-rds";
import * as r53 from "aws-cdk-lib/aws-route53";
import * as r53_targets from "aws-cdk-lib/aws-route53-targets";
import * as s3 from "aws-cdk-lib/aws-s3";
import * as secret from "aws-cdk-lib/aws-secretsmanager";
import { ISecret } from "aws-cdk-lib/aws-secretsmanager";
import { IQueue } from "aws-cdk-lib/aws-sqs";
import { Construct } from "constructs";
import { EnvConfig } from "../../config/env-config";
import { defaultBedrockPolicyStatement } from "../shared/bedrock";
import { DnsZones } from "../shared/dns";
import { buildLbAccessLogPrefix } from "../shared/s3";
import { buildSecrets, Secrets, secretsToECS } from "../shared/secrets";
import { provideAccessToQueue } from "../shared/sqs";
import { addDefaultMetricsToTargetGroup } from "../shared/target-group";
import { isProd, isSandbox } from "../shared/util";

interface ApiProps extends StackProps {
  config: EnvConfig;
  version: string | undefined;
}

type EnvSpecificSettings = {
  desiredTaskCount: number;
  maxTaskCount: number;
  memoryLimitMiB: number;
  maxHealthyPercent: number;
  minHealthyPercent: number;
};
type Settings = EnvSpecificSettings & {
  loadBalancerIdleTimeout: Duration;
  cpu: number;
};

function getEnvSpecificSettings(config: EnvConfig): EnvSpecificSettings {
  if (isProd(config)) {
    return {
      desiredTaskCount: 12,
      maxTaskCount: 20,
      memoryLimitMiB: 4096,
      maxHealthyPercent: 120,
      minHealthyPercent: 80,
    };
  }
  if (isSandbox(config)) {
    return {
      desiredTaskCount: 2,
      maxTaskCount: 10,
      memoryLimitMiB: 2048,
      maxHealthyPercent: 200,
      minHealthyPercent: 50,
    };
  }
  return {
    desiredTaskCount: 1,
    maxTaskCount: 5,
    memoryLimitMiB: 2048,
    maxHealthyPercent: 200,
    minHealthyPercent: 50,
  };
}
function getSettings(config: EnvConfig): Settings {
  return {
    ...getEnvSpecificSettings(config),
    cpu: 1024, // Keep to 1 vCPU because NodeJS is single-threaded
    loadBalancerIdleTimeout: Duration.minutes(10),
  };
}

export function createAPIService({
  stack,
  props,
  secrets,
  vpc,
  dbCredsSecret,
  dbReadReplicaEndpoint,
  dynamoDBTokenTable,
  alarmAction,
  dnsZones,
  fhirServerUrl,
  fhirConverterQueueUrl,
  fhirConverterServiceUrl,
  cdaToVisualizationLambda,
  documentDownloaderLambda,
  outboundPatientDiscoveryLambda,
  outboundDocumentQueryLambda,
  outboundDocumentRetrievalLambda,
  patientImportParseLambda,
  patientImportResultLambda,
  patientImportBucket,
  ehrSyncPatientQueue,
  elationLinkPatientQueue,
  healthieLinkPatientQueue,
  ehrStartResourceDiffBundlesQueue,
  ehrRefreshEhrBundlesQueue,
  ehrBundleBucket,
  generalBucket,
  conversionBucket,
  medicalDocumentsUploadBucket,
  ehrResponsesBucket,
  fhirToBundleLambda,
  fhirToBundleCountLambda,
  fhirToMedicalRecordLambda2,
  fhirToCdaConverterLambda,
  rateLimitTable,
  searchIngestionQueue,
  searchEndpoint,
  searchAuth,
  searchIndexName,
  featureFlagsTable,
  cookieStore,
}: {
  stack: Construct;
  props: ApiProps;
  secrets: Secrets;
  vpc: ec2.IVpc;
  dbCredsSecret: secret.ISecret;
  dbReadReplicaEndpoint: rds.Endpoint;
  dynamoDBTokenTable: dynamodb.Table;
  alarmAction: SnsAction | undefined;
  dnsZones: DnsZones;
  fhirServerUrl: string;
  fhirConverterQueueUrl: string | undefined;
  fhirConverterServiceUrl: string | undefined;
  cdaToVisualizationLambda: ILambda;
  documentDownloaderLambda: ILambda;
  outboundPatientDiscoveryLambda: ILambda;
  outboundDocumentQueryLambda: ILambda;
  outboundDocumentRetrievalLambda: ILambda;
  patientImportParseLambda: ILambda;
  patientImportResultLambda: ILambda;
  patientImportBucket: s3.IBucket;
  ehrSyncPatientQueue: IQueue;
  elationLinkPatientQueue: IQueue;
  healthieLinkPatientQueue: IQueue;
  ehrStartResourceDiffBundlesQueue: IQueue;
  ehrRefreshEhrBundlesQueue: IQueue;
  ehrBundleBucket: s3.IBucket;
  generalBucket: s3.IBucket;
  conversionBucket: s3.IBucket;
  medicalDocumentsUploadBucket: s3.IBucket;
  ehrResponsesBucket: s3.IBucket | undefined;
  fhirToBundleLambda: ILambda;
  fhirToBundleCountLambda: ILambda;
  fhirToMedicalRecordLambda2: ILambda | undefined;
  fhirToCdaConverterLambda: ILambda | undefined;
  rateLimitTable: dynamodb.Table;
  searchIngestionQueue: IQueue;
  searchEndpoint: string;
  searchAuth: { userName: string; secret: ISecret };
  searchIndexName: string;
  featureFlagsTable: dynamodb.Table;
  cookieStore: secret.ISecret | undefined;
}): {
  cluster: ecs.Cluster;
  service: ecs_patterns.ApplicationLoadBalancedFargateService;
  loadBalancer: NetworkLoadBalancer;
  serverAddress: string;
  loadBalancerAddress: string;
} {
  // Create a new Amazon Elastic Container Service (ECS) cluster
  const cluster = new ecs.Cluster(stack, "APICluster", { vpc, containerInsights: true });

  // Create an ECR repo where we'll deploy our Docker images to, and where ECS will pull from
  const ecrRepo = new Repository(stack, "APIRepo", {
    repositoryName: "metriport/api",
    lifecycleRules: [{ maxImageCount: 5000 }],
  });
  new CfnOutput(stack, "APIECRRepoURI", {
    description: "API ECR repository URI",
    value: ecrRepo.repositoryUri,
  });

  const connectWidgetUrlEnvVar = isSandbox(props.config)
    ? props.config.connectWidgetUrl
    : `https://${props.config.connectWidget.subdomain}.${props.config.connectWidget.domain}/`;

  const coverageEnhancementConfig = props.config.commonwell.coverageEnhancement;
  const dbReadReplicaEndpointAsString = JSON.stringify({
    host: dbReadReplicaEndpoint.hostname,
    port: dbReadReplicaEndpoint.port,
  });
  const dbPoolSettings = JSON.stringify(props.config.apiDatabase.poolSettings);
  // Run some servers on fargate containers
  const listenerPort = 80;
  const containerPort = 8080;
  const logGroup = LogGroup.fromLogGroupArn(stack, "ApiLogGroup", props.config.logArn);
  const {
    cpu,
    memoryLimitMiB,
    desiredTaskCount,
    maxTaskCount,
    loadBalancerIdleTimeout,
    maxHealthyPercent,
    minHealthyPercent,
  } = getSettings(props.config);
  const fargateService = new ecs_patterns.ApplicationLoadBalancedFargateService(
    stack,
    "APIFargateServiceAlb",
    {
      cluster: cluster,
      // Watch out for the combination of vCPUs and memory.
      // https://docs.aws.amazon.com/AmazonECS/latest/developerguide/task_definition_parameters.html#task_size
      cpu,
      memoryLimitMiB,
      desiredCount: desiredTaskCount,
      taskImageOptions: {
        image: ecs.ContainerImage.fromEcrRepository(ecrRepo, "latest"),
        containerPort,
        containerName: "API-Server",
        logDriver: ecs.LogDrivers.awsLogs({
          logGroup,
          streamPrefix: "APIFargateService",
        }),
        secrets: {
          DB_CREDS: ecs.Secret.fromSecretsManager(dbCredsSecret),
          SEARCH_PASSWORD: ecs.Secret.fromSecretsManager(searchAuth.secret),
          ...secretsToECS(secrets),
          ...secretsToECS(buildSecrets(stack, props.config.propelAuth.secrets)),
        },
        environment: {
          NODE_ENV: "production", // Determines its being run in the cloud, the logical env is set on ENV_TYPE
          ENV_TYPE: props.config.environmentType, // staging, production, sandbox
          ...(props.version ? { METRIPORT_VERSION: props.version } : undefined),
          AWS_REGION: props.config.region,
          LB_TIMEOUT_IN_MILLIS: loadBalancerIdleTimeout.toMilliseconds().toString(),
          DB_READ_REPLICA_ENDPOINT: dbReadReplicaEndpointAsString,
          DB_POOL_SETTINGS: dbPoolSettings,
          TOKEN_TABLE_NAME: dynamoDBTokenTable.tableName,
          API_URL: `https://${props.config.subdomain}.${props.config.domain}`,
          API_LB_ADDRESS: props.config.loadBalancerDnsName,
          ...(props.config.apiGatewayUsagePlanId
            ? { API_GW_USAGE_PLAN_ID: props.config.apiGatewayUsagePlanId }
            : {}),
          CONNECT_WIDGET_URL: connectWidgetUrlEnvVar,
          SYSTEM_ROOT_OID: props.config.systemRootOID,
          SYSTEM_ROOT_ORG_NAME: props.config.systemRootOrgName,
          ...props.config.commonwell.envVars,
          ...(props.config.slack ? props.config.slack : undefined),
          ...(props.config.sentryDSN ? { SENTRY_DSN: props.config.sentryDSN } : undefined),
          ...(props.config.usageReportUrl && {
            USAGE_URL: props.config.usageReportUrl,
          }),
          CONVERSION_RESULT_BUCKET_NAME: conversionBucket.bucketName,
          ...(props.config.medicalDocumentsBucketName && {
            MEDICAL_DOCUMENTS_BUCKET_NAME: props.config.medicalDocumentsBucketName,
          }),
          ...(props.config.medicalDocumentsUploadBucketName && {
            MEDICAL_DOCUMENTS_UPLOADS_BUCKET_NAME: props.config.medicalDocumentsUploadBucketName,
          }),
          // TODO we have access to ehrResponsesBucket here, can't we use it instead of a config?
          ...(props.config.ehrResponsesBucketName && {
            EHR_RESPONSES_BUCKET_NAME: props.config.ehrResponsesBucketName,
          }),
          ...(isSandbox(props.config) && {
            SANDBOX_SEED_DATA_BUCKET_NAME: props.config.sandboxSeedDataBucketName,
          }),
          PROPELAUTH_AUTH_URL: props.config.propelAuth.authUrl,
          PROPELAUTH_PUBLIC_KEY: props.config.propelAuth.publicKey,
          CONVERT_DOC_LAMBDA_NAME: cdaToVisualizationLambda.functionName,
          DOCUMENT_DOWNLOADER_LAMBDA_NAME: documentDownloaderLambda.functionName,
          OUTBOUND_PATIENT_DISCOVERY_LAMBDA_NAME: outboundPatientDiscoveryLambda.functionName,
          OUTBOUND_DOC_QUERY_LAMBDA_NAME: outboundDocumentQueryLambda.functionName,
          OUTBOUND_DOC_RETRIEVAL_LAMBDA_NAME: outboundDocumentRetrievalLambda.functionName,
          PATIENT_IMPORT_BUCKET_NAME: patientImportBucket.bucketName,
          PATIENT_IMPORT_PARSE_LAMBDA_NAME: patientImportParseLambda.functionName,
          PATIENT_IMPORT_RESULT_LAMBDA_NAME: patientImportResultLambda.functionName,
          EHR_SYNC_PATIENT_QUEUE_URL: ehrSyncPatientQueue.queueUrl,
          ELATION_LINK_PATIENT_QUEUE_URL: elationLinkPatientQueue.queueUrl,
          HEALTHIE_LINK_PATIENT_QUEUE_URL: healthieLinkPatientQueue.queueUrl,
          EHR_START_RESOURCE_DIFF_BUNDLES_QUEUE_URL: ehrStartResourceDiffBundlesQueue.queueUrl,
          EHR_REFRESH_EHR_BUNDLES_QUEUE_URL: ehrRefreshEhrBundlesQueue.queueUrl,
          EHR_BUNDLE_BUCKET_NAME: ehrBundleBucket.bucketName,
          FHIR_TO_BUNDLE_LAMBDA_NAME: fhirToBundleLambda.functionName,
          FHIR_TO_BUNDLE_COUNT_LAMBDA_NAME: fhirToBundleCountLambda.functionName,
          ...(fhirToMedicalRecordLambda2 && {
            FHIR_TO_MEDICAL_RECORD_LAMBDA2_NAME: fhirToMedicalRecordLambda2.functionName,
          }),
          ...(fhirToCdaConverterLambda && {
            FHIR_TO_CDA_CONVERTER_LAMBDA_NAME: fhirToCdaConverterLambda.functionName,
          }),
          FHIR_SERVER_URL: fhirServerUrl,
          ...(fhirConverterQueueUrl && {
            FHIR_CONVERTER_QUEUE_URL: fhirConverterQueueUrl,
          }),
          ...(fhirConverterServiceUrl && {
            FHIR_CONVERTER_SERVER_URL: fhirConverterServiceUrl,
          }),
          RATE_LIMIT_TABLE_NAME: rateLimitTable.tableName,
          SEARCH_INGESTION_QUEUE_URL: searchIngestionQueue.queueUrl,
          SEARCH_ENDPOINT: searchEndpoint,
          SEARCH_USERNAME: searchAuth.userName,
          SEARCH_INDEX: searchIndexName,
          ...(props.config.carequality?.envVars?.CQ_ORG_URLS && {
            CQ_ORG_URLS: props.config.carequality.envVars.CQ_ORG_URLS,
          }),
          ...(props.config.carequality?.envVars?.CQ_URLS_TO_EXCLUDE && {
            CQ_URLS_TO_EXCLUDE: props.config.carequality.envVars.CQ_URLS_TO_EXCLUDE,
          }),
          ...(props.config.carequality?.envVars?.CQ_ADDITIONAL_ORGS && {
            CQ_ADDITIONAL_ORGS: JSON.stringify(props.config.carequality.envVars.CQ_ADDITIONAL_ORGS),
          }),
          ...(props.config.locationService && {
            PLACE_INDEX_NAME: props.config.locationService.placeIndexName,
            PLACE_INDEX_REGION: props.config.locationService.placeIndexRegion,
          }),
          FEATURE_FLAGS_TABLE_NAME: featureFlagsTable.tableName,
          ...(coverageEnhancementConfig && {
            CW_MANAGEMENT_URL: coverageEnhancementConfig.managementUrl,
          }),
          ...(cookieStore && {
            CW_MANAGEMENT_COOKIE_SECRET_ARN: cookieStore.secretArn,
          }),
          ...(props.config.iheGateway?.trustStoreBucketName && {
            CQ_TRUST_BUNDLE_BUCKET_NAME: props.config.iheGateway.trustStoreBucketName,
          }),
          ...(props.config.ehrIntegration && {
            EHR_ATHENA_ENVIRONMENT: props.config.ehrIntegration.athenaHealth.env,
            EHR_ELATION_ENVIRONMENT: props.config.ehrIntegration.elation.env,
            EHR_HEALTHIE_ENVIRONMENT: props.config.ehrIntegration.healthie.env,
          }),
          ...(!isSandbox(props.config) && {
            DASH_URL: props.config.dashUrl,
            EHR_DASH_URL: props.config.ehrDashUrl,
          }),
        },
      },
      healthCheckGracePeriod: Duration.seconds(60),
      protocol: ApplicationProtocol.HTTP,
      listenerPort,
      publicLoadBalancer: false,
      idleTimeout: loadBalancerIdleTimeout,
      maxHealthyPercent,
      minHealthyPercent,
    }
  );
  // https://docs.aws.amazon.com/AmazonECS/latest/developerguide/task_definition_parameters.html
  // fargateService.taskDefinition.defaultContainer?.addUlimits({ ... });

  const serverAddress = fargateService.loadBalancer.loadBalancerDnsName;
  const apiUrl = `${props.config.subdomain}.${props.config.domain}`;
  new r53.ARecord(stack, "APIDomainPrivateRecord", {
    recordName: apiUrl,
    zone: dnsZones.privateZone,
    target: r53.RecordTarget.fromAlias(
      new r53_targets.LoadBalancerTarget(fargateService.loadBalancer)
    ),
  });

  const alb = fargateService.loadBalancer;
  alb.logAccessLogs(generalBucket, buildLbAccessLogPrefix("api"));

  const nlb = new NetworkLoadBalancer(stack, `ApiNetworkLoadBalancer`, {
    vpc,
    internetFacing: false,
  });
  const nlbListener = nlb.addListener(`ApiNetworkLoadBalancerListener`, {
    port: listenerPort,
    protocol: Protocol.TCP,
  });
  const nlbTargetGroup = new NetworkTargetGroup(stack, `ApiNetworkTargetGroup`, {
    port: listenerPort,
    protocol: Protocol.TCP,
    vpc,
    targets: [new AlbTarget(alb, listenerPort)],
  });
  nlbListener.addTargetGroups("ApiNetworkLoadBalancerTargetGroup", nlbTargetGroup);

  // Health checks
  const targetGroup = fargateService.targetGroup;
  const healthcheck = {
    healthyThresholdCount: 2,
    unhealthyThresholdCount: 2,
    interval: Duration.seconds(10),
  };
  targetGroup.configureHealthCheck(healthcheck);
  nlbTargetGroup.configureHealthCheck({
    ...healthcheck,
    interval: healthcheck.interval.plus(Duration.seconds(3)),
  });
  addDefaultMetricsToTargetGroup({
    targetGroup,
    scope: stack,
    id: "API",
    alarmAction,
  });

  // Access grant for Aurora DB's secret
  dbCredsSecret.grantRead(fargateService.taskDefinition.taskRole);
  // RW grant for Dynamo DB
  dynamoDBTokenTable.grantReadWriteData(fargateService.taskDefinition.taskRole);
  rateLimitTable.grantReadWriteData(fargateService.taskDefinition.taskRole);
  featureFlagsTable.grantReadWriteData(fargateService.taskDefinition.taskRole);

  cdaToVisualizationLambda.grantInvoke(fargateService.taskDefinition.taskRole);
  documentDownloaderLambda.grantInvoke(fargateService.taskDefinition.taskRole);
  outboundPatientDiscoveryLambda.grantInvoke(fargateService.taskDefinition.taskRole);
  outboundDocumentQueryLambda.grantInvoke(fargateService.taskDefinition.taskRole);
  outboundDocumentRetrievalLambda.grantInvoke(fargateService.taskDefinition.taskRole);
  patientImportParseLambda.grantInvoke(fargateService.taskDefinition.taskRole);
  patientImportResultLambda.grantInvoke(fargateService.taskDefinition.taskRole);
  fhirToCdaConverterLambda?.grantInvoke(fargateService.taskDefinition.taskRole);
  fhirToBundleLambda.grantInvoke(fargateService.taskDefinition.taskRole);
  fhirToBundleCountLambda.grantInvoke(fargateService.taskDefinition.taskRole);
  // Access grant for buckets
  patientImportBucket.grantReadWrite(fargateService.taskDefinition.taskRole);
  conversionBucket.grantReadWrite(fargateService.taskDefinition.taskRole);
  medicalDocumentsUploadBucket.grantReadWrite(fargateService.taskDefinition.taskRole);
  ehrBundleBucket.grantReadWrite(fargateService.taskDefinition.taskRole);
  if (ehrResponsesBucket) {
    ehrResponsesBucket.grantReadWrite(fargateService.taskDefinition.taskRole);
  }

  if (fhirToMedicalRecordLambda2) {
    fhirToMedicalRecordLambda2.grantInvoke(fargateService.taskDefinition.taskRole);
  }

  if (cookieStore) {
    cookieStore.grantRead(fargateService.service.taskDefinition.taskRole);
    cookieStore.grantWrite(fargateService.service.taskDefinition.taskRole);
  }

  provideAccessToQueue({
    accessType: "send",
    queue: ehrSyncPatientQueue,
    resource: fargateService.taskDefinition.taskRole,
  });
  provideAccessToQueue({
    accessType: "send",
    queue: elationLinkPatientQueue,
    resource: fargateService.taskDefinition.taskRole,
  });
  provideAccessToQueue({
    accessType: "send",
    queue: healthieLinkPatientQueue,
    resource: fargateService.taskDefinition.taskRole,
  });
  provideAccessToQueue({
    accessType: "send",
    queue: ehrStartResourceDiffBundlesQueue,
    resource: fargateService.taskDefinition.taskRole,
  });
  provideAccessToQueue({
    accessType: "send",
    queue: ehrRefreshEhrBundlesQueue,
    resource: fargateService.taskDefinition.taskRole,
  });

  // Allow access to search services/infra
  provideAccessToQueue({
    accessType: "send",
    queue: searchIngestionQueue,
    resource: fargateService.taskDefinition.taskRole,
  });
  searchAuth.secret.grantRead(fargateService.taskDefinition.taskRole);

  fargateService.taskDefinition.taskRole.attachInlinePolicy(
    new iam.Policy(stack, "OssApiSpecialPermissions", {
      statements: [
        new iam.PolicyStatement({
          actions: ["apigateway:GET"],
          resources: ["*"],
        }),
        new iam.PolicyStatement({
          actions: ["geo:SearchPlaceIndexForText"],
          resources: [`arn:aws:geo:*`],
          effect: iam.Effect.ALLOW,
        }),
        // TODO: 2711 - Remove when data pipeline webhook is migrated
        defaultBedrockPolicyStatement,
      ],
    })
  );

  // CloudWatch Alarms and Notifications

  // Allow the service to publish metrics to cloudwatch
  Metric.grantPutMetricData(fargateService.service.taskDefinition.taskRole);

  const fargateCPUAlarm = fargateService.service
    .metricCpuUtilization()
    .createAlarm(stack, "CPUAlarm", {
      threshold: 85,
      evaluationPeriods: 3,
      datapointsToAlarm: 2,
      treatMissingData: cloudwatch.TreatMissingData.NOT_BREACHING,
    });
  alarmAction && fargateCPUAlarm.addAlarmAction(alarmAction);
  alarmAction && fargateCPUAlarm.addOkAction(alarmAction);

  const fargateMemoryAlarm = fargateService.service
    .metricMemoryUtilization()
    .createAlarm(stack, "MemoryAlarm", {
      threshold: 85,
      evaluationPeriods: 3,
      datapointsToAlarm: 2,
      treatMissingData: cloudwatch.TreatMissingData.NOT_BREACHING,
    });
  alarmAction && fargateMemoryAlarm.addAlarmAction(alarmAction);
  alarmAction && fargateMemoryAlarm.addOkAction(alarmAction);

  // allow the LB to talk to fargate
  fargateService.service.connections.allowFrom(
    ec2.Peer.ipv4(vpc.vpcCidrBlock),
    ec2.Port.allTraffic(),
    "Allow traffic from within the VPC to the service secure port"
  );
  // TODO: #489 ain't the most secure, but the above code doesn't work as CDK complains we can't use the connections
  // from the cluster created above, should be fine for now as it will only accept connections in the VPC
  fargateService.service.connections.allowFromAnyIpv4(ec2.Port.allTcp());

  // hookup autoscaling based on thresholds
  const scaling = fargateService.service.autoScaleTaskCount({
    minCapacity: desiredTaskCount,
    maxCapacity: maxTaskCount,
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

  return {
    cluster,
    service: fargateService,
    serverAddress: apiUrl,
    loadBalancer: nlb,
    loadBalancerAddress: serverAddress,
  };
}
