import {
  Aspects,
  CfnOutput,
  Duration,
  RemovalPolicy,
  Stack,
  StackProps,
  aws_wafv2 as wafv2,
} from "aws-cdk-lib";
import * as apig from "aws-cdk-lib/aws-apigateway";
import { BackupResource } from "aws-cdk-lib/aws-backup";
import * as cert from "aws-cdk-lib/aws-certificatemanager";
import * as cloudwatch from "aws-cdk-lib/aws-cloudwatch";
import { SnsAction } from "aws-cdk-lib/aws-cloudwatch-actions";
import * as cognito from "aws-cdk-lib/aws-cognito";
import * as dynamodb from "aws-cdk-lib/aws-dynamodb";
import * as ec2 from "aws-cdk-lib/aws-ec2";
import { InstanceType, Port } from "aws-cdk-lib/aws-ec2";
import * as ecs_patterns from "aws-cdk-lib/aws-ecs-patterns";
import * as iam from "aws-cdk-lib/aws-iam";
import * as lambda from "aws-cdk-lib/aws-lambda";
import { Function as Lambda } from "aws-cdk-lib/aws-lambda";
import { LogGroup } from "aws-cdk-lib/aws-logs";
import * as rds from "aws-cdk-lib/aws-rds";
import * as r53 from "aws-cdk-lib/aws-route53";
import * as r53_targets from "aws-cdk-lib/aws-route53-targets";
import * as s3 from "aws-cdk-lib/aws-s3";
import * as secret from "aws-cdk-lib/aws-secretsmanager";
import * as sns from "aws-cdk-lib/aws-sns";
import { ITopic } from "aws-cdk-lib/aws-sns";
import { Construct } from "constructs";
import { EnvConfig, EnvConfigSandbox } from "../config/env-config";
import { AlarmSlackBot } from "./api-stack/alarm-slack-chatbot";
import { createScheduledAPIQuotaChecker } from "./api-stack/api-quota-checker";
import { createAPIService } from "./api-stack/api-service";
import * as ccdaSearch from "./api-stack/ccda-search-connector";
import { createCqDirectoryRebuilder } from "./api-stack/cq-directory-rebuilder";
import * as cwEnhancedCoverageConnector from "./api-stack/cw-enhanced-coverage-connector";
import { createScheduledDBMaintenance } from "./api-stack/db-maintenance";
import { createDocQueryChecker } from "./api-stack/doc-query-checker";
import * as documentUploader from "./api-stack/document-upload";
import { createFHIRConverterService } from "./api-stack/fhir-converter-service";
import { TerminologyServerNestedStack } from "./api-stack/terminology-server-service";
import { EhrNestedStack } from "./ehr-nested-stack";
import { EnvType } from "./env-type";
import { FeatureFlagsNestedStack } from "./feature-flags-nested-stack";
import { Hl7NotificationWebhookSenderNestedStack } from "./hl7-notification-webhook-sender-nested-stack";
import { IHEGatewayV2LambdasNestedStack } from "./ihe-gateway-v2-stack";
import { createJobsScheduler } from "./jobs/jobs-scheduler";
import { JobsNestedStack } from "./jobs/jobs-stack";
import { LambdasLayersNestedStack } from "./lambda-layers-nested-stack";
import { CDA_TO_VIS_TIMEOUT, LambdasNestedStack } from "./lambdas-nested-stack";
import { PatientImportNestedStack } from "./patient-import-nested-stack";
import { PatientMonitoringNestedStack } from "./patient-monitoring-nested-stack";
import { RateLimitingNestedStack } from "./rate-limiting-nested-stack";
import { DailyBackup } from "./shared/backup";
import { addErrorAlarmToLambdaFunc, createLambda, MAXIMUM_LAMBDA_TIMEOUT } from "./shared/lambda";
import { LambdaLayers } from "./shared/lambda-layers";
import { addDBClusterPerformanceAlarms } from "./shared/rds";
import { getSecrets, Secrets } from "./shared/secrets";
import { provideAccessToQueue } from "./shared/sqs";
import { isProd, isSandbox } from "./shared/util";
import { wafRules } from "./shared/waf-rules";
import { SurescriptsNestedStack } from "./surescripts/surescripts-stack";

const FITBIT_LAMBDA_TIMEOUT = Duration.seconds(60);

interface APIStackProps extends StackProps {
  config: EnvConfig;
  version: string | undefined;
}

export class APIStack extends Stack {
  public readonly vpc: ec2.IVpc;
  public readonly alarmAction: SnsAction | undefined;

  constructor(scope: Construct, id: string, props: APIStackProps) {
    super(scope, id, props);

    const awsAccount = props.env?.account;
    if (!awsAccount) throw new Error("Missing AWS account");

    this.terminationProtection = true;

    //-------------------------------------------
    // Secrets
    //-------------------------------------------
    const secrets = getSecrets(this, props.config);

    const slackNotification = setupSlackNotifSnsTopic(this, props.config);
    this.alarmAction = slackNotification?.alarmAction;

    //-------------------------------------------
    // VPC + NAT Gateway.
    //-------------------------------------------
    const vpcConstructId = "APIVpc";
    this.vpc = new ec2.Vpc(this, vpcConstructId, {
      flowLogs: {
        apiVPCFlowLogs: { trafficType: ec2.FlowLogTrafficType.REJECT },
      },
    });

    const privateZone = new r53.PrivateHostedZone(this, "PrivateZone", {
      vpc: this.vpc,
      zoneName: props.config.host,
    });
    const publicZone = r53.HostedZone.fromLookup(this, "Zone", {
      domainName: props.config.host,
    });
    const dnsZones = { privateZone, publicZone };

    //-------------------------------------------
    // Vpc Endpoints
    //-------------------------------------------
    new ec2.InterfaceVpcEndpoint(this, "ApiVpcSqsEndpoint", {
      vpc: this.vpc,
      service: ec2.InterfaceVpcEndpointAwsService.SQS,
      privateDnsEnabled: true,
    });

    //-------------------------------------------
    // Buckets
    //-------------------------------------------
    let outgoingHl7NotificationBucket: s3.IBucket | undefined;
    if (props.config.hl7Notification) {
      outgoingHl7NotificationBucket = s3.Bucket.fromBucketName(
        this,
        "OutgoingHl7MessageBucket",
        props.config.hl7Notification.outgoingMessageBucketName
      );
    }

    //-------------------------------------------
    // Security Setup
    //-------------------------------------------
    // Create a cert for HTTPS
    const certificate = new cert.DnsValidatedCertificate(this, "APICert", {
      domainName: props.config.domain,
      hostedZone: publicZone,
      subjectAlternativeNames: [`*.${props.config.domain}`],
    });

    // add error alarming to CDK-generated lambdas
    const certificateRequestorLambda = certificate.node.findChild(
      "CertificateRequestorFunction"
    ) as unknown as lambda.SingletonFunction;
    addErrorAlarmToLambdaFunc(
      this,
      certificateRequestorLambda,
      "APICertificateCertificateRequestorFunctionAlarm",
      slackNotification?.alarmAction
    );

    // Web application firewall for enhanced security
    const waf = new wafv2.CfnWebACL(this, "APIWAF", {
      defaultAction: { allow: {} },
      scope: "REGIONAL",
      name: `APIWAF`,
      rules: wafRules,
      visibilityConfig: {
        cloudWatchMetricsEnabled: true,
        metricName: `APIWAF-Metric`,
        sampledRequestsEnabled: false,
      },
    });

    //-------------------------------------------
    // Application-wide feature flags
    //-------------------------------------------
    const { featureFlagsTable } = new FeatureFlagsNestedStack(this, "FeatureFlags", {
      config: props.config,
      alarmAction: slackNotification?.alarmAction,
    });

    //-------------------------------------------
    // Aurora Database for backend data
    //-------------------------------------------

    const dbConfig = props.config.apiDatabase;
    const dbClusterName = "api-cluster";
    // create database credentials
    const dbCredsSecret = new secret.Secret(this, "DBCreds", {
      secretName: `DBCreds`,
      generateSecretString: {
        secretStringTemplate: JSON.stringify({
          username: dbConfig.username,
        }),
        excludePunctuation: true,
        includeSpace: false,
        generateStringKey: "password",
      },
    });
    const dbCreds = rds.Credentials.fromSecret(dbCredsSecret);
    const dbEngine = rds.DatabaseClusterEngine.auroraPostgres({
      version: rds.AuroraPostgresEngineVersion.VER_14_7,
    });
    const parameterGroup = new rds.ParameterGroup(this, "APIDB_Params", {
      engine: dbEngine,
      parameters: {
        ...(dbConfig.minSlowLogDurationInMs
          ? {
              log_min_duration_statement: dbConfig.minSlowLogDurationInMs.toString(),
            }
          : undefined),
      },
    });

    const dbCluster = new rds.DatabaseCluster(this, "APIDB", {
      engine: dbEngine,
      instanceProps: {
        vpc: this.vpc,
        instanceType: new InstanceType("serverless"),
        enablePerformanceInsights: true,
        parameterGroup,
      },
      preferredMaintenanceWindow: dbConfig.maintenanceWindow,
      credentials: dbCreds,
      defaultDatabaseName: dbConfig.name,
      clusterIdentifier: dbClusterName,
      storageEncrypted: true,
      parameterGroup,
      cloudwatchLogsExports: ["postgresql"],
      deletionProtection: true,
      removalPolicy: RemovalPolicy.RETAIN,
    });
    Aspects.of(dbCluster).add({
      visit(node) {
        if (node instanceof rds.CfnDBCluster) {
          node.serverlessV2ScalingConfiguration = {
            minCapacity: dbConfig.minCapacity,
            maxCapacity: dbConfig.maxCapacity,
          };
        }
      },
    });
    addDBClusterPerformanceAlarms(
      this,
      dbCluster,
      dbClusterName,
      dbConfig,
      slackNotification?.alarmAction
    );

    //----------------------------------------------------------
    // DynamoDB
    //----------------------------------------------------------

    // global table for auth token management
    const dynamoConstructName = "APIUserTokens";
    const dynamoDBTokenTable = new dynamodb.Table(this, dynamoConstructName, {
      partitionKey: { name: "token", type: dynamodb.AttributeType.STRING },
      replicationRegions: this.isProd(props) ? ["us-east-1"] : ["ca-central-1"],
      replicationTimeout: Duration.hours(3),
      encryption: dynamodb.TableEncryption.AWS_MANAGED,
      pointInTimeRecovery: true,
    });
    dynamoDBTokenTable.addGlobalSecondaryIndex({
      indexName: "oauthUserAccessToken_idx",
      partitionKey: {
        name: "oauthUserAccessToken",
        type: dynamodb.AttributeType.STRING,
      },
      projectionType: dynamodb.ProjectionType.ALL,
    });
    this.addDynamoPerformanceAlarms(
      dynamoDBTokenTable,
      dynamoConstructName,
      slackNotification?.alarmAction
    );

    //-------------------------------------------
    // S3 buckets
    //-------------------------------------------
    const generalBucket = new s3.Bucket(this, "GeneralBucket", {
      bucketName: props.config.generalBucketName,
      publicReadAccess: false,
      encryption: s3.BucketEncryption.S3_MANAGED,
      versioned: true,
    });

    const medicalDocumentsBucket = new s3.Bucket(this, "APIMedicalDocumentsBucket", {
      bucketName: props.config.medicalDocumentsBucketName,
      publicReadAccess: false,
      encryption: s3.BucketEncryption.S3_MANAGED,
      versioned: true,
      cors: [
        {
          allowedOrigins: ["*"],
          allowedMethods: [s3.HttpMethods.GET],
        },
      ],
    });

    const medicalDocumentsUploadBucket = new s3.Bucket(this, "APIMedicalDocumentsUploadBucket", {
      bucketName: props.config.medicalDocumentsUploadBucketName,
      publicReadAccess: false,
      encryption: s3.BucketEncryption.S3_MANAGED,
      versioned: true,
      cors: [
        {
          allowedOrigins: ["*"],
          allowedMethods: [s3.HttpMethods.PUT, s3.HttpMethods.POST],
        },
      ],
    });

    let hl7ConversionBucket: s3.Bucket | undefined;
    if (!isSandbox(props.config) && props.config.hl7Notification.hl7ConversionBucketName) {
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      hl7ConversionBucket = new s3.Bucket(this, "HL7ConversionBucket", {
        bucketName: props.config.hl7Notification.hl7ConversionBucketName,
        publicReadAccess: false,
        encryption: s3.BucketEncryption.S3_MANAGED,
        versioned: true,
      });
    }

    let ehrResponsesBucket: s3.Bucket | undefined;
    if (!isSandbox(props.config)) {
      ehrResponsesBucket = new s3.Bucket(this, "EhrResponsedBucket", {
        bucketName: props.config.ehrResponsesBucketName,
        publicReadAccess: false,
        encryption: s3.BucketEncryption.S3_MANAGED,
        versioned: true,
      });
    }

    const getSandboxSeedDataBucket = (sandboxConfig: EnvConfigSandbox) => {
      const seedBucketCfnName = "APISandboxSeedDataBucket";
      try {
        return s3.Bucket.fromBucketName(
          this,
          seedBucketCfnName,
          sandboxConfig.sandboxSeedDataBucketName
        );
      } catch (error) {
        return new s3.Bucket(this, seedBucketCfnName, {
          bucketName: sandboxConfig.sandboxSeedDataBucketName,
          publicReadAccess: false,
          encryption: s3.BucketEncryption.S3_MANAGED,
          cors: [
            {
              allowedOrigins: ["*"],
              allowedMethods: [s3.HttpMethods.GET],
            },
          ],
        });
      }
    };

    const sandboxSeedDataBucket = isSandbox(props.config)
      ? getSandboxSeedDataBucket(props.config)
      : undefined;

    //-------------------------------------------
    // Lambda Layers
    //-------------------------------------------
    const { lambdaLayers } = new LambdasLayersNestedStack(this, "LambdasLayersNestedStack");

    //-------------------------------------------
    // OPEN SEARCH Domains
    //-------------------------------------------
    const {
      ccdaIngestionQueue: ccdaSearchIngestionQueue,
      searchDomainEndpoint,
      searchDomainUserName,
      searchDomainSecret,
      ccdaIndexName: ccdaSearchIndexName,
    } = ccdaSearch.setup({
      stack: this,
      vpc: this.vpc,
      awsAccount,
      ccdaS3Bucket: medicalDocumentsBucket,
      lambdaLayers,
      envType: props.config.environmentType,
      alarmSnsAction: slackNotification?.alarmAction,
    });

    //-------------------------------------------
    // Surescripts
    //-------------------------------------------
    let surescriptsStack: SurescriptsNestedStack | undefined = undefined;
    if (props.config.surescripts) {
      surescriptsStack = new SurescriptsNestedStack(this, "SurescriptsNestedStack", {
        config: props.config,
        vpc: this.vpc,
        alarmAction: slackNotification?.alarmAction,
        lambdaLayers,
      });
    }

    //-------------------------------------------
    // General lambdas
    //-------------------------------------------
    const {
      cdaToVisualizationLambda,
      documentDownloaderLambda,
      fhirToCdaConverterLambda,
      outboundPatientDiscoveryLambda,
      outboundDocumentQueryLambda,
      outboundDocumentRetrievalLambda,
      fhirToBundleLambda,
      fhirToBundleCountLambda,
      fhirConverterConnector: {
        queue: fhirConverterQueue,
        lambda: fhirConverterLambda,
        bucket: fhirConverterBucket,
      },
      hl7v2RosterUploadLambdas,
      conversionResultNotifierLambda,
      consolidatedSearchLambda,
      consolidatedIngestionLambda,
      consolidatedIngestionQueue,
    } = new LambdasNestedStack(this, "LambdasNestedStack", {
      config: props.config,
      vpc: this.vpc,
      lambdaLayers,
      dbCluster,
      secrets,
      medicalDocumentsBucket,
      pharmacyBundleBucket: surescriptsStack?.getAssets()?.pharmacyConversionBucket,
      sandboxSeedDataBucket,
      alarmAction: slackNotification?.alarmAction,
      bedrock: props.config.bedrock,
      featureFlagsTable,
      openSearch: {
        endpoint: searchDomainEndpoint,
        auth: {
          userName: searchDomainUserName,
          secret: searchDomainSecret,
        },
        consolidatedIndexName: props.config.openSearch.openSearch.consolidatedIndexName,
        documentIndexName: props.config.openSearch.openSearch.indexName,
      },
    });

    //-------------------------------------------
    // HL7 Notification Webhook Sender
    //-------------------------------------------
    let hl7NotificationWebhookSenderLambda: lambda.Function | undefined;
    if (props.config.hl7Notification && outgoingHl7NotificationBucket && hl7ConversionBucket) {
      const { lambda } = new Hl7NotificationWebhookSenderNestedStack(
        this,
        "Hl7NotificationWebhookSenderNestedStack",
        {
          config: props.config,
          lambdaLayers,
          vpc: this.vpc,
          alarmAction: slackNotification?.alarmAction,
          outgoingHl7NotificationBucket,
          hl7ConversionBucket,
          secrets,
        }
      );

      hl7NotificationWebhookSenderLambda = lambda;
    }

    //-------------------------------------------
    // Patient Monitoring
    //-------------------------------------------
    let dischargeRequeryLambda: lambda.Function | undefined;
    if (props.config.hl7Notification) {
      const { dischargeRequeryLambda: lambda } = new PatientMonitoringNestedStack(
        this,
        "PatientMonitoringNestedStack",
        {
          config: props.config,
          lambdaLayers,
          vpc: this.vpc,
          alarmAction: slackNotification?.alarmAction,
          secrets,
        }
      );

      dischargeRequeryLambda = lambda;
    }

    //-------------------------------------------
    // Patient Import
    //-------------------------------------------
    const {
      parseLambda: patientImportParseLambda,
      createLambda: patientImportCreateLambda,
      queryLambda: patientImportQueryLambda,
      resultLambda: patientImportResultLambda,
      bucket: patientImportBucket,
    } = new PatientImportNestedStack(this, "PatientImportNestedStack", {
      config: props.config,
      lambdaLayers,
      vpc: this.vpc,
      alarmAction: slackNotification?.alarmAction,
    });

    //-------------------------------------------
    // EHR
    //-------------------------------------------
    const {
      getAppointmentsLambda: ehrGetAppointmentsLambda,
      syncPatientQueue: ehrSyncPatientQueue,
      syncPatientLambda: ehrSyncPatientLambda,
      elationLinkPatientQueue,
      elationLinkPatientLambda,
      healthieLinkPatientQueue,
      healthieLinkPatientLambda,
      computeResourceDiffBundlesLambda: ehrComputeResourceDiffBundlesLambda,
      refreshEhrBundlesQueue: ehrRefreshEhrBundlesQueue,
      refreshEhrBundlesLambda: ehrRefreshEhrBundlesLambda,
      ehrBundleBucket,
    } = new EhrNestedStack(this, "EhrNestedStack", {
      config: props.config,
      lambdaLayers,
      vpc: this.vpc,
      alarmAction: slackNotification?.alarmAction,
      ehrResponsesBucket,
      medicalDocumentsBucket,
    });

    //-------------------------------------------
    // Jobs
    //-------------------------------------------
    const jobsStack = new JobsNestedStack(this, "JobsNestedStack", {
      config: props.config,
      vpc: this.vpc,
      alarmAction: slackNotification?.alarmAction,
      lambdaLayers,
    });

    //-------------------------------------------
    // Rate Limiting
    //-------------------------------------------
    const { rateLimitTable } = new RateLimitingNestedStack(this, "RateLimitingNestedStack", {
      config: props.config,
      alarmAction: slackNotification?.alarmAction,
    });

    //-------------------------------------------
    // Terminology Server Service
    //-------------------------------------------
    if (!isSandbox(props.config)) {
      new TerminologyServerNestedStack(this, "TerminologyServerNestedStack", {
        config: props.config,
        version: props.version,
        generalBucket: generalBucket,
        vpc: this.vpc,
        alarmAction: slackNotification?.alarmAction,
      });
    }

    //-------------------------------------------
    // FHIR Converter Service
    //-------------------------------------------
    let fhirConverter: ReturnType<typeof createFHIRConverterService> | undefined;
    if (!isSandbox(props.config)) {
      fhirConverter = createFHIRConverterService(
        this,
        { ...props, generalBucket },
        this.vpc,
        slackNotification?.alarmAction
      );
    }

    let fhirToMedicalRecordLambda2: Lambda | undefined = undefined;
    if (!isSandbox(props.config)) {
      const lambdas = this.setupFhirToMedicalRecordLambda({
        lambdaLayers,
        vpc: this.vpc,
        medicalDocumentsBucket,
        envType: props.config.environmentType,
        dashUrl: props.config.dashUrl,
        sentryDsn: props.config.lambdasSentryDSN,
        alarmAction: slackNotification?.alarmAction,
        featureFlagsTable,
        ...props.config.fhirToMedicalLambda,
      });
      fhirToMedicalRecordLambda2 = lambdas.fhirToMedicalRecordLambda2;
    }

    const cwEnhancedQueryQueues = cwEnhancedCoverageConnector.setupRequiredInfra({
      stack: this,
      vpc: this.vpc,
      lambdaLayers,
      envType: props.config.environmentType,
      secrets,
      apiAddress: "",
      bucket: generalBucket,
      alarmSnsAction: slackNotification?.alarmAction,
    });
    const cookieStore = cwEnhancedQueryQueues?.cookieStore;

    //-------------------------------------------
    // ECR + ECS + Fargate for Backend Servers
    //-------------------------------------------
    const {
      cluster,
      service: apiService,
      loadBalancer: apiLoadBalancer,
      loadBalancerAddress: apiDirectUrl,
      serverAddress: apiServerUrl,
    } = createAPIService({
      stack: this,
      props,
      secrets,
      vpc: this.vpc,
      dbCredsSecret,
      dbReadReplicaEndpoint: dbCluster.clusterReadEndpoint,
      dynamoDBTokenTable,
      alarmAction: slackNotification?.alarmAction,
      dnsZones,
      fhirServerUrl: props.config.fhirServerUrl,
      fhirConverterQueueUrl: fhirConverterQueue.queueUrl,
      fhirConverterServiceUrl: fhirConverter ? `http://${fhirConverter.address}` : undefined,
      cdaToVisualizationLambda,
      documentDownloaderLambda,
      outboundPatientDiscoveryLambda,
      outboundDocumentQueryLambda,
      outboundDocumentRetrievalLambda,
      patientImportParseLambda,
      patientImportResultLambda,
      patientImportBucket,
      dischargeRequeryLambda,
      ehrSyncPatientQueue,
      elationLinkPatientQueue,
      healthieLinkPatientQueue,
      ehrRefreshEhrBundlesQueue,
      ehrGetAppointmentsLambda,
      ehrBundleBucket,
      generalBucket,
      conversionBucket: fhirConverterBucket,
      medicalDocumentsUploadBucket,
      ehrResponsesBucket,
      fhirToMedicalRecordLambda2,
      fhirToCdaConverterLambda,
      fhirToBundleLambda,
      fhirToBundleCountLambda,
      consolidatedSearchLambda,
      consolidatedIngestionQueue,
      rateLimitTable,
      searchIngestionQueue: ccdaSearchIngestionQueue,
      searchEndpoint: searchDomainEndpoint,
      searchAuth: { userName: searchDomainUserName, secret: searchDomainSecret },
      searchIndexName: ccdaSearchIndexName,
      featureFlagsTable,
      cookieStore,
      surescriptsAssets: surescriptsStack?.getAssets(),
      jobAssets: jobsStack.getAssets(),
    });
    const apiLoadBalancerAddress = apiLoadBalancer.loadBalancerDnsName;

    if (props.config.iheGateway) {
      const mtlsBucketName = s3.Bucket.fromBucketName(
        this,
        "TruststoreBucket",
        props.config.iheGateway.trustStoreBucketName
      );
      new IHEGatewayV2LambdasNestedStack(this, "IHEGatewayV2LambdasNestedStack", {
        lambdaLayers,
        vpc: this.vpc,
        apiTaskRole: apiService.taskDefinition.taskRole,
        secrets,
        cqOrgCertificate: props.config.carequality?.secretNames.CQ_ORG_CERTIFICATE,
        cqOrgPrivateKey: props.config.carequality?.secretNames.CQ_ORG_PRIVATE_KEY,
        cqOrgCertificateIntermediate:
          props.config.carequality?.secretNames.CQ_ORG_CERTIFICATE_INTERMEDIATE,
        cqOrgPrivateKeyPassword: props.config.carequality?.secretNames.CQ_ORG_PRIVATE_KEY_PASSWORD,
        cqTrustBundleBucket: mtlsBucketName,
        medicalDocumentsBucket: medicalDocumentsBucket,
        apiURL: apiDirectUrl,
        envType: props.config.environmentType,
        sentryDsn: props.config.lambdasSentryDSN,
        iheResponsesBucketName: props.config.iheResponsesBucketName,
        iheParsedResponsesBucketName: props.config.iheParsedResponsesBucketName,
        alarmAction: slackNotification?.alarmAction,
      });
    }

    // Access grant for Aurora DB
    dbCluster.connections.allowDefaultPortFrom(apiService.service);

    // setup a private link so the API GW can talk to the API's LB
    const link = new apig.VpcLink(this, "link", {
      targets: [apiLoadBalancer],
    });

    const integration = new apig.Integration({
      type: apig.IntegrationType.HTTP_PROXY,
      options: {
        connectionType: apig.ConnectionType.VPC_LINK,
        vpcLink: link,
        requestParameters: {
          "integration.request.path.proxy": "method.request.path.proxy",
        },
      },
      integrationHttpMethod: "ANY",
      uri: `http://${apiLoadBalancerAddress}/{proxy}`,
    });

    //-------------------------------------------
    // FHIR CONNECTORS - Finish setting it up
    //-------------------------------------------
    provideAccessToQueue({
      accessType: "send",
      queue: fhirConverterQueue,
      resource: apiService.service.taskDefinition.taskRole,
    });

    // Add ENV after the API service is created
    const lambdasToGetApiUrl: (lambda.Function | undefined)[] = [
      fhirToMedicalRecordLambda2,
      outboundPatientDiscoveryLambda,
      outboundDocumentQueryLambda,
      outboundDocumentRetrievalLambda,
      fhirToBundleLambda,
      fhirToBundleCountLambda,
      ...(hl7v2RosterUploadLambdas ?? []),
      hl7NotificationWebhookSenderLambda,
      dischargeRequeryLambda,
      patientImportCreateLambda,
      patientImportParseLambda,
      patientImportQueryLambda,
      patientImportResultLambda,
      ehrSyncPatientLambda,
      elationLinkPatientLambda,
      healthieLinkPatientLambda,
      ehrComputeResourceDiffBundlesLambda,
      ehrRefreshEhrBundlesLambda,
      ehrGetAppointmentsLambda,
      fhirConverterLambda,
      conversionResultNotifierLambda,
      consolidatedSearchLambda,
      consolidatedIngestionLambda,
      ...(surescriptsStack?.getLambdas() ?? []),
      jobsStack.getAssets().runPatientJobLambda,
    ];
    const apiUrl = `http://${apiDirectUrl}`;
    lambdasToGetApiUrl.forEach(lambda => lambda?.addEnvironment("API_URL", apiUrl));

    // TODO move this to each place where it's used
    // Access grant for medical documents bucket
    sandboxSeedDataBucket &&
      sandboxSeedDataBucket.grantReadWrite(apiService.taskDefinition.taskRole);
    medicalDocumentsBucket.grantReadWrite(apiService.taskDefinition.taskRole);
    medicalDocumentsBucket.grantReadWrite(documentDownloaderLambda);
    medicalDocumentsBucket.grantRead(fhirConverterLambda);
    medicalDocumentsBucket.grantRead(ehrComputeResourceDiffBundlesLambda);

    createDocQueryChecker({
      lambdaLayers,
      stack: this,
      vpc: this.vpc,
      apiAddress: apiDirectUrl,
      alarmSnsAction: slackNotification?.alarmAction,
    });

    createCqDirectoryRebuilder({
      lambdaLayers,
      stack: this,
      vpc: this.vpc,
      apiAddress: apiDirectUrl,
      alarmSnsAction: slackNotification?.alarmAction,
    });

    createJobsScheduler({
      lambdaLayers,
      stack: this,
      vpc: this.vpc,
      apiAddress: apiDirectUrl,
      alarmSnsAction: slackNotification?.alarmAction,
    });

    cookieStore &&
      cwEnhancedCoverageConnector.setupLambdas({
        stack: this,
        vpc: this.vpc,
        lambdaLayers,
        envType: props.config.environmentType,
        secrets,
        apiAddress: apiDirectUrl,
        bucket: generalBucket,
        alarmSnsAction: slackNotification?.alarmAction,
        cookieStore,
      });

    //-------------------------------------------
    // API Gateway
    //-------------------------------------------

    const accessLogDestination = new apig.LogGroupLogDestination(
      new LogGroup(this, "APIAccessLogGroup", {
        removalPolicy: RemovalPolicy.RETAIN,
      })
    );
    const accessLogFormat = apig.AccessLogFormat.jsonWithStandardFields({
      caller: true,
      httpMethod: true,
      ip: true,
      protocol: true,
      requestTime: true,
      resourcePath: true,
      responseLength: true,
      status: true,
      user: true,
    });

    // Create the API Gateway
    // example from https://bobbyhadz.com/blog/aws-cdk-api-gateway-example
    const api = new apig.RestApi(this, "api", {
      description: "Metriport API Gateway",
      defaultIntegration: integration,
      defaultCorsPreflightOptions: {
        allowOrigins: ["*"],
        allowHeaders: ["*"],
      },
      deployOptions: {
        accessLogDestination,
        accessLogFormat,
      },
    });

    // add domain cert + record
    api.addDomainName("APIDomain", {
      domainName: apiServerUrl,
      certificate: certificate,
      securityPolicy: apig.SecurityPolicy.TLS_1_2,
    });
    new r53.ARecord(this, "APIDomainRecord", {
      recordName: apiServerUrl,
      zone: publicZone,
      target: r53.RecordTarget.fromAlias(new r53_targets.ApiGateway(api)),
    });

    // add basic usage plan
    const plan = api.addUsagePlan("APIUsagePlan", {
      name: "Base Plan",
      description: "Base Plan for API",
      apiStages: [{ api: api, stage: api.deploymentStage }],
      throttle: {
        burstLimit: 10,
        rateLimit: 50,
      },
      quota: {
        limit: this.isProd(props) ? 10000 : 500,
        period: apig.Period.DAY,
      },
    });

    // Hookup the API GW to the WAF
    new wafv2.CfnWebACLAssociation(this, "APIWAFAssociation", {
      resourceArn: api.deploymentStage.stageArn,
      webAclArn: waf.attrArn,
    });

    // create the proxy to the fargate service
    const proxy = new apig.ProxyResource(this, `${id}/Proxy`, {
      parent: api.root,
      anyMethod: false,
    });
    proxy.addMethod("ANY", integration, {
      requestParameters: {
        "method.request.path.proxy": true,
      },
      apiKeyRequired: true,
    });

    this.createFeedbackRoutes({
      apiGateway: api,
      link,
      apiAddress: apiLoadBalancerAddress,
      config: props.config,
    });

    this.setupTestLambda(
      lambdaLayers,
      props.config.environmentType,
      apiDirectUrl,
      generalBucket,
      props.config.lambdasSentryDSN
    );

    // token auth for connect sessions
    const tokenAuth = this.setupTokenAuthLambda(
      lambdaLayers,
      dynamoDBTokenTable,
      slackNotification?.alarmAction,
      props.config.environmentType,
      props.config.lambdasSentryDSN
    );

    // setup /token path with token auth
    this.setupAPIGWApiTokenResource(id, api, link, tokenAuth, apiLoadBalancerAddress);

    const userPoolClientSecret = this.setupOAuthUserPool(props.config, publicZone);
    const oauthScopes = this.enableFHIROnUserPool(userPoolClientSecret);
    const oauthAuth = this.setupOAuthAuthorizer(userPoolClientSecret);
    this.setupAPIGWOAuthResource(id, api, link, oauthAuth, oauthScopes, apiLoadBalancerAddress);

    const contributionResource = api.root.addResource("doc-contribution");

    // setup cw doc contribution
    this.setupCWDocContribution({
      baseResource: contributionResource,
      lambdaLayers,
      alarmAction: slackNotification?.alarmAction,
      authorizer: oauthAuth,
      oauthScopes: oauthScopes,
      envType: props.config.environmentType,
      bucket: medicalDocumentsBucket,
    });

    // TODO move this to its own stack/nested stack, name it accordingly so it doesn't
    // confuse with the regular FHIRConverter service/lambda
    // CONVERT API
    const convertResource = api.root.addResource("convert");
    const convertBaseResource = convertResource.addResource("v1");
    const ccdaConvertResource = convertBaseResource.addResource("ccda");
    const ccdaConvertBaseResource = ccdaConvertResource.addResource("to");
    const ccdaToFhirConvertResource = ccdaConvertBaseResource.addResource("fhir");
    const ccdaToFhirLambda = new lambda.DockerImageFunction(this, "convertApiCcdaToFhir", {
      functionName: "convertApiCcdaToFhir",
      vpc: this.vpc,
      code: lambda.DockerImageCode.fromImageAsset("../fhir-converter", {
        file: "Dockerfile.lambda",
      }),
      timeout: Duration.minutes(1),
      memorySize: 1024,
    });
    ccdaToFhirConvertResource.addMethod("POST", new apig.LambdaIntegration(ccdaToFhirLambda), {
      apiKeyRequired: true,
    });

    // WEBHOOKS
    const webhookResource = api.root.addResource("webhook");

    documentUploader.createLambda({
      lambdaLayers,
      stack: this,
      vpc: this.vpc,
      apiAddress: apiDirectUrl,
      envType: props.config.environmentType,
      medicalDocumentsBucket,
      medicalDocumentsUploadBucket,
      sentryDsn: props.config.lambdasSentryDSN,
    });

    this.setupBulkUrlSigningLambda({
      lambdaLayers,
      vpc: this.vpc,
      medicalDocumentsBucket: medicalDocumentsBucket,
      medicalSeedDocumentsBucket: sandboxSeedDataBucket,
      fhirServerUrl: props.config.fhirServerUrl,
      envType: props.config.environmentType,
      sentryDsn: props.config.lambdasSentryDSN,
      alarmAction: slackNotification?.alarmAction,
      searchEndpoint: searchDomainEndpoint,
      searchIndex: ccdaSearchIndexName,
      searchUserName: searchDomainUserName,
      searchPassword: searchDomainSecret.secretValue.unsafeUnwrap(),
      apiTaskRole: apiService.service.taskDefinition.taskRole,
      apiAddress: apiDirectUrl,
    });

    this.setupGarminWebhookAuth({
      lambdaLayers,
      baseResource: webhookResource,
      vpc: this.vpc,
      fargateService: apiService,
      dynamoDBTokenTable,
      envType: props.config.environmentType,
      sentryDsn: props.config.lambdasSentryDSN,
    });

    this.setupWithingsWebhookAuth({
      lambdaLayers,
      baseResource: webhookResource,
      vpc: this.vpc,
      fargateService: apiService,
      envType: props.config.environmentType,
      sentryDsn: props.config.lambdasSentryDSN,
    });

    this.setupFitbitWebhook({
      lambdaLayers,
      baseResource: webhookResource,
      secrets,
      vpc: this.vpc,
      fargateService: apiService,
      fitbitClientSecret: props.config.providerSecretNames.FITBIT_CLIENT_SECRET,
      fitbitSubscriberVerificationCode:
        props.config.providerSecretNames.FITBIT_SUBSCRIBER_VERIFICATION_CODE,
      envType: props.config.environmentType,
      sentryDsn: props.config.lambdasSentryDSN,
    });

    this.setupTenoviWebhookAuth({
      lambdaLayers,
      baseResource: webhookResource,
      secrets,
      vpc: this.vpc,
      fargateService: apiService,
      tenoviAuthHeader: props.config.providerSecretNames.TENOVI_AUTH_HEADER,
      envType: props.config.environmentType,
      sentryDsn: props.config.lambdasSentryDSN,
    });

    // add webhook path for apple health clients
    const appleHealthResource = webhookResource.addResource("apple");
    const integrationApple = new apig.Integration({
      type: apig.IntegrationType.HTTP_PROXY,
      options: {
        connectionType: apig.ConnectionType.VPC_LINK,
        vpcLink: link,
      },
      integrationHttpMethod: "POST",
      uri: `http://${apiLoadBalancerAddress}${appleHealthResource.path}`,
    });
    appleHealthResource.addMethod("POST", integrationApple, {
      apiKeyRequired: true,
    });

    // add another usage plan for Publishable (Client) API keys
    // everything is throttled to 0 - except explicitely permitted routes
    const appleHealthThrottleKey = `${appleHealthResource.path}/POST`;
    const clientPlan = new apig.CfnUsagePlan(this, "APIClientUsagePlan", {
      usagePlanName: "Client Plan",
      description: "Client Plan for API",
      apiStages: [
        {
          apiId: api.restApiId,
          stage: api.deploymentStage.stageName,
          throttle: {
            "*/*": { burstLimit: 0, rateLimit: 0 },
            [appleHealthThrottleKey]: { burstLimit: 10, rateLimit: 50 },
          },
        },
      ],
      throttle: {
        burstLimit: 10,
        rateLimit: 50,
      },
      quota: {
        limit: this.isProd(props) ? 10000 : 500,
        period: apig.Period.DAY,
      },
    });

    createScheduledAPIQuotaChecker({
      stack: this,
      lambdaLayers,
      vpc: this.vpc,
      apiAddress: apiDirectUrl,
    });
    createScheduledDBMaintenance({
      stack: this,
      lambdaLayers,
      vpc: this.vpc,
      apiAddress: apiDirectUrl,
    });

    //-------------------------------------------
    // Backups
    //-------------------------------------------
    if (this.isProd(props)) {
      new DailyBackup(this, "APIDBBackup", {
        backupPlanName: "APIDB",
        resources: [BackupResource.fromRdsDatabaseCluster(dbCluster)],
      });
      new DailyBackup(this, "APIMedicalDocsBucketBackup", {
        backupPlanName: "MedicalDocsBucket",
        resources: [BackupResource.fromArn(medicalDocumentsBucket.bucketArn)],
      });
    }
    if (isSandbox(props.config) && sandboxSeedDataBucket) {
      new DailyBackup(this, "APISandboxSeedDataBucketBackup", {
        backupPlanName: "SandboxSeedDataBucket",
        resources: [BackupResource.fromArn(sandboxSeedDataBucket.bucketArn)],
      });
    }

    //-------------------------------------------
    // Output
    //-------------------------------------------
    new CfnOutput(this, "APIGatewayUrl", {
      description: "API Gateway URL",
      value: api.url,
    });
    new CfnOutput(this, "APIGatewayID", {
      description: "API Gateway ID",
      value: api.restApiId,
    });
    new CfnOutput(this, "APIGatewayRootResourceID", {
      description: "API Gateway Root Resource ID",
      value: api.root.resourceId,
    });
    new CfnOutput(this, "APIGatewayWebhookResourceID", {
      description: "API Gateway Webhook Resource ID",
      value: webhookResource.resourceId,
    });
    new CfnOutput(this, "VPCID", {
      description: "VPC ID",
      value: this.vpc.vpcId,
    });
    new CfnOutput(this, "DBClusterID", {
      description: "DB Cluster ID",
      value: dbCluster.clusterIdentifier,
    });
    new CfnOutput(this, "FargateServiceARN", {
      description: "Fargate Service ARN",
      value: apiService.service.serviceArn,
    });
    new CfnOutput(this, "APIECSClusterARN", {
      description: "API ECS Cluster ARN",
      value: cluster.clusterArn,
    });
    new CfnOutput(this, "APIUsagePlan", {
      description: "API Usage Plan",
      value: plan.usagePlanId,
    });
    new CfnOutput(this, "ClientAPIUsagePlan", {
      description: "Client API Usage Plan",
      value: clientPlan.attrId,
    });
    new CfnOutput(this, "APIDBCluster", {
      description: "API DB Cluster",
      value: `${dbCluster.clusterEndpoint.hostname} ${dbCluster.clusterEndpoint.port} ${dbCluster.clusterEndpoint.socketAddress}`,
    });
    new CfnOutput(this, "ClientSecretUserpoolID", {
      description: "Userpool for client secret based apps",
      value: userPoolClientSecret.userPoolId,
    });
  }

  createFeedbackRoutes({
    apiGateway: api,
    link,
    apiAddress,
    config,
  }: {
    apiGateway: apig.RestApi;
    link: apig.VpcLink;
    apiAddress: string;
    config: EnvConfig;
  }) {
    if (isSandbox(config)) return;

    const id = "FeedbackApi";
    api.addUsagePlan(`${id}UsagePlan`, {
      name: "Feedback API Usage Plan",
      description: "Usage Plan for the Feedback API",
      apiStages: [{ api: api, stage: api.deploymentStage }],
      throttle: {
        burstLimit: 5,
        rateLimit: 10,
      },
      quota: {
        limit: 1_000,
        period: apig.Period.DAY,
      },
    });
    const proxyPath = "feedback";
    const apiGwResource = api.root.addResource(proxyPath, {
      defaultCorsPreflightOptions: { allowOrigins: ["*"], allowHeaders: ["*"] },
    });
    const apiGwProxy = new apig.ProxyResource(this, `${id}/${proxyPath}/Proxy`, {
      parent: apiGwResource,
      anyMethod: false,
      defaultCorsPreflightOptions: { allowOrigins: ["*"], allowHeaders: ["*"] },
    });
    const apiGwProxyIntegration = new apig.Integration({
      type: apig.IntegrationType.HTTP_PROXY,
      options: {
        connectionType: apig.ConnectionType.VPC_LINK,
        vpcLink: link,
        requestParameters: {
          "integration.request.path.proxy": "method.request.path.proxy",
        },
      },
      integrationHttpMethod: "ANY",
      uri: `http://${apiAddress}/${proxyPath}/{proxy}`,
    });
    apiGwProxy.addMethod("ANY", apiGwProxyIntegration, {
      requestParameters: {
        "method.request.path.proxy": true,
      },
      apiKeyRequired: true,
    });
  }

  private setupTestLambda(
    lambdaLayers: LambdaLayers,
    envType: EnvType,
    apiAddress: string,
    generalBucket: s3.IBucket,
    sentryDsn: string | undefined
  ) {
    const lambda = createLambda({
      stack: this,
      name: "Tester",
      layers: [lambdaLayers.shared, lambdaLayers.wkHtmlToPdf],
      vpc: this.vpc,
      subnets: this.vpc.privateSubnets,
      entry: "tester",
      envType,
      envVars: {
        API_URL: apiAddress,
        GENERAL_BUCKET_NAME: generalBucket.bucketName,
        ...(sentryDsn ? { SENTRY_DSN: sentryDsn } : {}),
      },
    });
    generalBucket.grantReadWrite(lambda);
    return lambda;
  }

  private setupGarminWebhookAuth(ownProps: {
    lambdaLayers: LambdaLayers;
    baseResource: apig.Resource;
    vpc: ec2.IVpc;
    fargateService: ecs_patterns.ApplicationLoadBalancedFargateService;
    dynamoDBTokenTable: dynamodb.Table;
    envType: EnvType;
    sentryDsn: string | undefined;
  }) {
    const {
      lambdaLayers,
      baseResource,
      vpc,
      fargateService: server,
      dynamoDBTokenTable,
      envType,
      sentryDsn,
    } = ownProps;

    const garminLambda = createLambda({
      stack: this,
      name: "Garmin",
      runtime: lambda.Runtime.NODEJS_16_X,
      entry: "garmin",
      layers: [lambdaLayers.shared],
      envType,
      envVars: {
        TOKEN_TABLE_NAME: dynamoDBTokenTable.tableName,
        API_URL: `http://${server.loadBalancer.loadBalancerDnsName}/webhook/garmin`,
        ...(sentryDsn ? { SENTRY_DSN: sentryDsn } : {}),
      },
      vpc,
    });

    // Grant lambda access to the DynamoDB token table
    garminLambda.role && dynamoDBTokenTable.grantReadData(garminLambda.role);

    // Grant lambda access to the api server
    server.service.connections.allowFrom(garminLambda, Port.allTcp());

    // setup $base/garmin path with token auth
    const garminResource = baseResource.addResource("garmin");
    garminResource.addMethod("ANY", new apig.LambdaIntegration(garminLambda));
  }

  private setupWithingsWebhookAuth(ownProps: {
    lambdaLayers: LambdaLayers;
    baseResource: apig.Resource;
    vpc: ec2.IVpc;
    fargateService: ecs_patterns.ApplicationLoadBalancedFargateService;
    envType: EnvType;
    sentryDsn: string | undefined;
  }) {
    const {
      lambdaLayers,
      baseResource,
      vpc,
      fargateService: server,
      envType,
      sentryDsn,
    } = ownProps;

    const withingsLambda = createLambda({
      stack: this,
      name: "Withings",
      runtime: lambda.Runtime.NODEJS_16_X,
      entry: "withings",
      layers: [lambdaLayers.shared, lambdaLayers.dig],
      envType,
      envVars: {
        API_URL: `http://${server.loadBalancer.loadBalancerDnsName}/webhook/withings`,
        ...(sentryDsn ? { SENTRY_DSN: sentryDsn } : {}),
      },
      vpc,
    });

    // Grant lambda access to the api server
    server.service.connections.allowFrom(withingsLambda, Port.allTcp());

    const withingsResource = baseResource.addResource("withings");
    withingsResource.addMethod("ANY", new apig.LambdaIntegration(withingsLambda));
  }

  private setupFitbitWebhook(ownProps: {
    lambdaLayers: LambdaLayers;
    baseResource: apig.Resource;
    secrets: Secrets;
    vpc: ec2.IVpc;
    fargateService: ecs_patterns.ApplicationLoadBalancedFargateService;
    fitbitClientSecret: string;
    fitbitSubscriberVerificationCode: string;
    envType: EnvType;
    sentryDsn: string | undefined;
  }) {
    const {
      lambdaLayers,
      baseResource,
      secrets,
      vpc,
      fargateService: server,
      fitbitClientSecret,
      fitbitSubscriberVerificationCode,
      envType,
      sentryDsn,
    } = ownProps;

    const fitbitAuthLambda = createLambda({
      stack: this,
      name: "FitbitAuth",
      runtime: lambda.Runtime.NODEJS_18_X,
      entry: "fitbit-auth",
      layers: [lambdaLayers.shared],
      envType,
      envVars: {
        API_URL: `http://${server.loadBalancer.loadBalancerDnsName}/webhook/fitbit`,
        FITBIT_CLIENT_SECRET: fitbitClientSecret,
        FITBIT_TIMEOUT_MS: FITBIT_LAMBDA_TIMEOUT.toMilliseconds().toString(),
        ...(sentryDsn ? { SENTRY_DSN: sentryDsn } : {}),
      },
      vpc,
      timeout: FITBIT_LAMBDA_TIMEOUT,
    });

    const fitbitSubscriberVerificationLambda = createLambda({
      stack: this,
      name: "FitbitSubscriberVerification",
      runtime: lambda.Runtime.NODEJS_18_X,
      entry: "fitbit-subscriber-verification",
      layers: [lambdaLayers.shared],
      envType,
      envVars: {
        FITBIT_SUBSCRIBER_VERIFICATION_CODE: fitbitSubscriberVerificationCode,
        ...(sentryDsn ? { SENTRY_DSN: sentryDsn } : {}),
      },
      vpc,
    });

    // granting secrets read access to both lambdas
    const fitbitClientSecretKey = "FITBIT_CLIENT_SECRET";
    if (!secrets[fitbitClientSecretKey]) {
      throw new Error(`${fitbitClientSecretKey} is not defined in config`);
    }
    const fitbitSubVerifSecretKey = "FITBIT_SUBSCRIBER_VERIFICATION_CODE";
    secrets[fitbitClientSecretKey].grantRead(fitbitAuthLambda);
    if (!secrets[fitbitSubVerifSecretKey]) {
      throw new Error(`${fitbitSubVerifSecretKey} is not defined in config`);
    }
    secrets[fitbitSubVerifSecretKey].grantRead(fitbitSubscriberVerificationLambda);

    const fitbitResource = baseResource.addResource("fitbit");
    fitbitResource.addMethod("POST", new apig.LambdaIntegration(fitbitAuthLambda));
    fitbitResource.addMethod("GET", new apig.LambdaIntegration(fitbitSubscriberVerificationLambda));
  }

  private setupTenoviWebhookAuth(ownProps: {
    lambdaLayers: LambdaLayers;
    baseResource: apig.Resource;
    secrets: Secrets;
    vpc: ec2.IVpc;
    fargateService: ecs_patterns.ApplicationLoadBalancedFargateService;
    tenoviAuthHeader: string;
    envType: EnvType;
    sentryDsn: string | undefined;
  }) {
    const {
      lambdaLayers,
      baseResource,
      secrets,
      vpc,
      fargateService: server,
      tenoviAuthHeader,
      envType,
      sentryDsn,
    } = ownProps;

    const tenoviAuthLambda = createLambda({
      stack: this,
      name: "TenoviAuth",
      runtime: lambda.Runtime.NODEJS_18_X,
      entry: "tenovi",
      layers: [lambdaLayers.shared],
      envType,
      envVars: {
        API_URL: `http://${server.loadBalancer.loadBalancerDnsName}/webhook/tenovi`,
        TENOVI_AUTH_HEADER: tenoviAuthHeader,
        ...(sentryDsn ? { SENTRY_DSN: sentryDsn } : {}),
      },
      vpc,
    });

    const tenoviAuthHeaderSecretKey = "TENOVI_AUTH_HEADER";
    if (!secrets[tenoviAuthHeaderSecretKey]) {
      throw new Error(`${tenoviAuthHeaderSecretKey} is not defined in config`);
    }

    secrets[tenoviAuthHeaderSecretKey].grantRead(tenoviAuthLambda);

    const tenoviResource = baseResource.addResource("tenovi");
    tenoviResource.addMethod("POST", new apig.LambdaIntegration(tenoviAuthLambda));
  }

  private setupBulkUrlSigningLambda(ownProps: {
    lambdaLayers: LambdaLayers;
    vpc: ec2.IVpc;
    medicalDocumentsBucket: s3.Bucket;
    medicalSeedDocumentsBucket: s3.IBucket | undefined;
    fhirServerUrl: string;
    envType: EnvType;
    sentryDsn: string | undefined;
    alarmAction: SnsAction | undefined;
    searchEndpoint: string;
    searchIndex: string;
    searchUserName: string;
    searchPassword: string;
    apiTaskRole: iam.IRole;
    apiAddress: string;
  }): Lambda {
    const {
      lambdaLayers,
      vpc,
      medicalDocumentsBucket,
      medicalSeedDocumentsBucket,
      fhirServerUrl,
      sentryDsn,
      alarmAction,
      envType,
      searchEndpoint,
      searchIndex,
      searchUserName,
      searchPassword,
      apiTaskRole,
      apiAddress,
    } = ownProps;

    const isSandboxSeed = envType === "sandbox" && medicalSeedDocumentsBucket;

    const bulkUrlSigningLambda = createLambda({
      stack: this,
      name: "BulkUrlSigning",
      runtime: lambda.Runtime.NODEJS_18_X,
      entry: "document-bulk-signer",
      envType,
      envVars: {
        MEDICAL_DOCUMENTS_BUCKET_NAME: isSandboxSeed
          ? medicalSeedDocumentsBucket.bucketName
          : medicalDocumentsBucket.bucketName,
        FHIR_SERVER_URL: fhirServerUrl,
        SEARCH_ENDPOINT: searchEndpoint,
        SEARCH_INDEX: searchIndex,
        SEARCH_USERNAME: searchUserName,
        SEARCH_PASSWORD: searchPassword,
        API_URL: `http://${apiAddress}`,
        ...(sentryDsn ? { SENTRY_DSN: sentryDsn } : {}),
      },
      layers: [lambdaLayers.shared],
      memory: 512,
      timeout: Duration.minutes(5),
      vpc,
      alarmSnsAction: alarmAction,
    });

    isSandboxSeed && medicalSeedDocumentsBucket.grantRead(bulkUrlSigningLambda);
    medicalDocumentsBucket.grantRead(bulkUrlSigningLambda);
    bulkUrlSigningLambda.grantInvoke(apiTaskRole);

    return bulkUrlSigningLambda;
  }

  private setupFhirToMedicalRecordLambda(ownProps: {
    lambdaLayers: LambdaLayers;
    vpc: ec2.IVpc;
    medicalDocumentsBucket: s3.Bucket;
    envType: EnvType;
    dashUrl: string;
    sentryDsn: string | undefined;
    alarmAction: SnsAction | undefined;
    featureFlagsTable: dynamodb.Table;
  }): { fhirToMedicalRecordLambda2: Lambda } {
    const {
      lambdaLayers,
      vpc,
      sentryDsn,
      envType,
      dashUrl,
      alarmAction,
      medicalDocumentsBucket,
      featureFlagsTable,
    } = ownProps;

    const lambdaTimeout = MAXIMUM_LAMBDA_TIMEOUT.minus(Duration.seconds(5));
    const axiosTimeout = lambdaTimeout.minus(Duration.seconds(5));

    const fhirToMedicalRecordLambda2 = createLambda({
      stack: this,
      name: "FhirToMedicalRecord2",
      runtime: lambda.Runtime.NODEJS_18_X,
      entry: "fhir-to-medical-record2",
      envType,
      envVars: {
        AXIOS_TIMEOUT_SECONDS: axiosTimeout.toSeconds().toString(),
        MEDICAL_DOCUMENTS_BUCKET_NAME: medicalDocumentsBucket.bucketName,
        PDF_CONVERT_TIMEOUT_MS: CDA_TO_VIS_TIMEOUT.toMilliseconds().toString(),
        FEATURE_FLAGS_TABLE_NAME: featureFlagsTable.tableName,
        DASH_URL: dashUrl,
        ...(sentryDsn ? { SENTRY_DSN: sentryDsn } : {}),
      },
      layers: [lambdaLayers.shared, lambdaLayers.langchain, lambdaLayers.wkHtmlToPdf],
      memory: 4096,
      timeout: lambdaTimeout,
      isEnableInsights: true,
      vpc,
      alarmSnsAction: alarmAction,
    });

    featureFlagsTable.grantReadData(fhirToMedicalRecordLambda2);

    medicalDocumentsBucket.grantReadWrite(fhirToMedicalRecordLambda2);

    return { fhirToMedicalRecordLambda2 };
  }

  private setupCWDocContribution(ownProps: {
    baseResource: apig.Resource;
    lambdaLayers: LambdaLayers;
    alarmAction: SnsAction | undefined;
    authorizer: apig.IAuthorizer;
    oauthScopes: cognito.OAuthScope[];
    envType: EnvType;
    bucket: s3.Bucket;
  }): Lambda {
    const { baseResource, lambdaLayers, alarmAction, authorizer, oauthScopes, envType, bucket } =
      ownProps;

    const cwLambda = createLambda({
      stack: this,
      name: "CommonWellDocContribution",
      runtime: lambda.Runtime.NODEJS_18_X,
      entry: "cw-doc-contribution",
      layers: [lambdaLayers.shared],
      alarmSnsAction: alarmAction,
      envType,
      envVars: {
        ...(bucket && {
          MEDICAL_DOCUMENTS_BUCKET_NAME: bucket.bucketName,
        }),
      },
    });

    const cwResource = baseResource.addResource("commonwell");
    cwResource.addMethod("GET", new apig.LambdaIntegration(cwLambda), {
      authorizer: authorizer,
      authorizationScopes: oauthScopes.map(s => s.scopeName),
    });

    bucket.grantReadWrite(cwLambda);

    return cwLambda;
  }

  private setupTokenAuthLambda(
    lambdaLayers: LambdaLayers,
    dynamoDBTokenTable: dynamodb.Table,
    alarmAction: SnsAction | undefined,
    envType: EnvType,
    sentryDsn: string | undefined
  ): apig.RequestAuthorizer {
    const tokenAuthLambda = createLambda({
      stack: this,
      name: "TokenAuth",
      runtime: lambda.Runtime.NODEJS_16_X,
      entry: "token-auth",
      layers: [lambdaLayers.shared],
      envType,
      envVars: {
        TOKEN_TABLE_NAME: dynamoDBTokenTable.tableName,
        ...(sentryDsn ? { SENTRY_DSN: sentryDsn } : {}),
      },
      alarmSnsAction: alarmAction,
    });

    const tokenAuth = new apig.RequestAuthorizer(this, "APITokenAuth", {
      handler: tokenAuthLambda,
      identitySources: ["method.request.querystring.state"],
      // todo: instead of removing caching, investigate explicitly listing
      //        the permitted methods in the lambda: "Resource: event.methodArn"
      //
      // see: https://forum.serverless.com/t/rest-api-with-custom-authorizer-how-are-you-dealing-with-authorization-and-policy-cache/3310
      resultsCacheTtl: Duration.minutes(0),
    });
    tokenAuthLambda.role && dynamoDBTokenTable.grantReadData(tokenAuthLambda.role);

    return tokenAuth;
  }

  private setupAPIGWApiTokenResource(
    stackId: string,
    api: apig.RestApi,
    link: apig.VpcLink,
    authorizer: apig.RequestAuthorizer,
    serverAddress: string
  ): apig.Resource {
    const apiTokenResource = api.root.addResource("token");
    const tokenProxy = new apig.ProxyResource(this, `${stackId}/token/Proxy`, {
      parent: apiTokenResource,
      anyMethod: false,
    });
    const integrationToken = new apig.Integration({
      type: apig.IntegrationType.HTTP_PROXY,
      options: {
        connectionType: apig.ConnectionType.VPC_LINK,
        vpcLink: link,
        requestParameters: {
          "integration.request.path.proxy": "method.request.path.proxy",
          "integration.request.header.api-token": "context.authorizer.api-token",
          "integration.request.header.cxId": "context.authorizer.cxId",
          "integration.request.header.userId": "context.authorizer.userId",
        },
      },
      integrationHttpMethod: "ANY",
      uri: `http://${serverAddress}/{proxy}`,
    });
    tokenProxy.addMethod("ANY", integrationToken, {
      requestParameters: {
        "method.request.path.proxy": true,
      },
      authorizer,
    });
    return apiTokenResource;
  }

  private setupOAuthUserPool(config: EnvConfig, dnsZone: r53.IHostedZone): cognito.IUserPool {
    const domainName = `${config.authSubdomain}.${config.domain}`;
    const userPool = new cognito.UserPool(this, "oauth-client-secret-user-pool2", {
      accountRecovery: cognito.AccountRecovery.EMAIL_ONLY,
      removalPolicy: RemovalPolicy.DESTROY,
    });
    const certificate = new cert.DnsValidatedCertificate(this, `UserPoolCertificate`, {
      domainName,
      hostedZone: dnsZone,
      region: "us-east-1", // Required by Cognito for custom certs - https://docs.aws.amazon.com/cognito/latest/developerguide/cognito-user-pools-add-custom-domain.html
    });
    const userPoolDomain = userPool.addDomain("metriport-custom-cognito-domain", {
      customDomain: { domainName, certificate },
    });
    new r53.ARecord(this, "AuthSubdomainRecord", {
      recordName: domainName,
      zone: dnsZone,
      target: r53.RecordTarget.fromAlias(new r53_targets.UserPoolDomainTarget(userPoolDomain)),
    });
    return userPool;
  }

  private enableFHIROnUserPool(userPool: cognito.IUserPool): cognito.OAuthScope[] {
    const scopes = [
      {
        scopeName: "document",
        scopeDescription: "query and retrieve document references",
      },
    ];
    const resourceServerScopes = scopes.map(s => new cognito.ResourceServerScope(s));
    const resourceServer = userPool.addResourceServer("FHIR-resource-server2", {
      identifier: "fhir",
      scopes: resourceServerScopes,
    });
    const oauthScopes = resourceServerScopes.map(s =>
      cognito.OAuthScope.resourceServer(resourceServer, s)
    );
    // Commonwell specific client
    userPool.addClient("commonwell-client2", {
      generateSecret: true,
      supportedIdentityProviders: [cognito.UserPoolClientIdentityProvider.COGNITO],
      oAuth: {
        flows: {
          clientCredentials: true,
        },
        scopes: oauthScopes,
      },
    });
    return oauthScopes;
  }

  private setupOAuthAuthorizer(userPool: cognito.IUserPool): apig.IAuthorizer {
    const cognitoAuthorizer = new apig.CognitoUserPoolsAuthorizer(this, `oauth-authorizer`, {
      cognitoUserPools: [userPool],
      identitySource: "method.request.header.Authorization",
    });
    return cognitoAuthorizer;
  }

  private setupAPIGWOAuthResource(
    stackId: string,
    api: apig.RestApi,
    vpcLink: apig.VpcLink,
    authorizer: apig.IAuthorizer,
    oauthScopes: cognito.OAuthScope[],
    serverAddress: string
  ): apig.Resource {
    const oauthResource = api.root.addResource("oauth", {
      defaultCorsPreflightOptions: { allowOrigins: ["*"] },
    });
    const oauthProxy = new apig.ProxyResource(this, `${stackId}/oauth/Proxy`, {
      parent: oauthResource,
      anyMethod: false,
      defaultCorsPreflightOptions: { allowOrigins: ["*"] },
    });
    const oauthProxyIntegration = new apig.Integration({
      type: apig.IntegrationType.HTTP_PROXY,
      options: {
        connectionType: apig.ConnectionType.VPC_LINK,
        vpcLink,
        requestParameters: {
          "integration.request.path.proxy": "method.request.path.proxy",
        },
      },
      integrationHttpMethod: "ANY",
      uri: `http://${serverAddress}/oauth/{proxy}`,
    });
    oauthProxy.addMethod("ANY", oauthProxyIntegration, {
      requestParameters: {
        "method.request.path.proxy": true,
      },
      authorizer,
      authorizationScopes: oauthScopes.map(s => s.scopeName),
    });
    return oauthResource;
  }

  private addDynamoPerformanceAlarms(
    table: dynamodb.Table,
    dynamoConstructName: string,
    alarmAction?: SnsAction
  ) {
    const readUnitsMetric = table.metricConsumedReadCapacityUnits();
    const readAlarm = readUnitsMetric.createAlarm(
      this,
      `${dynamoConstructName}ConsumedReadCapacityUnitsAlarm`,
      {
        threshold: 10_000, // units per second
        evaluationPeriods: 1,
        treatMissingData: cloudwatch.TreatMissingData.NOT_BREACHING,
      }
    );
    alarmAction && readAlarm.addAlarmAction(alarmAction);
    alarmAction && readAlarm.addOkAction(alarmAction);

    const writeUnitsMetric = table.metricConsumedWriteCapacityUnits();
    const writeAlarm = writeUnitsMetric.createAlarm(
      this,
      `${dynamoConstructName}ConsumedWriteCapacityUnitsAlarm`,
      {
        threshold: 10_000, // units per second
        evaluationPeriods: 1,
        treatMissingData: cloudwatch.TreatMissingData.NOT_BREACHING,
      }
    );
    alarmAction && writeAlarm.addAlarmAction(alarmAction);
    alarmAction && writeAlarm.addOkAction(alarmAction);
  }

  private isProd(props: APIStackProps): boolean {
    return isProd(props.config);
  }
}

function setupSlackNotifSnsTopic(
  stack: Stack,
  config: EnvConfig
): { snsTopic: ITopic; alarmAction: SnsAction } | undefined {
  if (!config.slack) return undefined;

  const slackNotifSnsTopic = new sns.Topic(stack, "SlackSnsTopic", {
    displayName: "Slack SNS Topic",
  });
  AlarmSlackBot.addSlackChannelConfig(stack, {
    configName: `slack-chatbot-configuration-` + config.environmentType,
    workspaceId: config.slack.workspaceId,
    channelId: config.slack.alertsChannelId,
    topics: [slackNotifSnsTopic],
  });
  const alarmAction = new SnsAction(slackNotifSnsTopic);
  return { snsTopic: slackNotifSnsTopic, alarmAction };
}
