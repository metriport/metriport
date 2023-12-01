import { Aspects, CfnOutput, Duration, RemovalPolicy, Stack, StackProps } from "aws-cdk-lib";
import * as apig from "aws-cdk-lib/aws-apigateway";
import * as cert from "aws-cdk-lib/aws-certificatemanager";
import * as cloudwatch from "aws-cdk-lib/aws-cloudwatch";
import { SnsAction } from "aws-cdk-lib/aws-cloudwatch-actions";
import * as cognito from "aws-cdk-lib/aws-cognito";
import * as dynamodb from "aws-cdk-lib/aws-dynamodb";
import * as ec2 from "aws-cdk-lib/aws-ec2";
import { InstanceType, Port } from "aws-cdk-lib/aws-ec2";
import * as ecs_patterns from "aws-cdk-lib/aws-ecs-patterns";
import * as lambda from "aws-cdk-lib/aws-lambda";
import { Function as Lambda } from "aws-cdk-lib/aws-lambda";
import * as rds from "aws-cdk-lib/aws-rds";
import * as r53 from "aws-cdk-lib/aws-route53";
import * as r53_targets from "aws-cdk-lib/aws-route53-targets";
import * as s3 from "aws-cdk-lib/aws-s3";
import * as secret from "aws-cdk-lib/aws-secretsmanager";
import * as sns from "aws-cdk-lib/aws-sns";
import { ITopic } from "aws-cdk-lib/aws-sns";
import { Construct } from "constructs";
import { EnvConfig } from "../config/env-config";
import { AlarmSlackBot } from "./api-stack/alarm-slack-chatbot";
import { createScheduledAPIQuotaChecker } from "./api-stack/api-quota-checker";
import { createAPIService } from "./api-stack/api-service";
import * as ccdaSearch from "./api-stack/ccda-search-connector";
import * as cwEnhancedCoverageConnector from "./api-stack/cw-enhanced-coverage-connector";
import { createDocQueryChecker } from "./api-stack/doc-query-checker";
import * as documentUploader from "./api-stack/document-upload";
import * as fhirConverterConnector from "./api-stack/fhir-converter-connector";
import { createFHIRConverterService } from "./api-stack/fhir-converter-service";
import * as fhirServerConnector from "./api-stack/fhir-server-connector";
import * as sidechainFHIRConverterConnector from "./api-stack/sidechain-fhir-converter-connector";
import { createAppConfigStack } from "./app-config-stack";
import { EnvType } from "./env-type";
import { createIHEStack } from "./ihe-stack";
import { addErrorAlarmToLambdaFunc, createLambda, MAXIMUM_LAMBDA_TIMEOUT } from "./shared/lambda";
import { LambdaLayers, setupLambdasLayers } from "./shared/lambda-layers";
import { getSecrets, Secrets } from "./shared/secrets";
import { provideAccessToQueue } from "./shared/sqs";
import { isProd, isSandbox, mbToBytes } from "./shared/util";

const FITBIT_LAMBDA_TIMEOUT = Duration.seconds(60);
const CDA_TO_VIS_TIMEOUT = Duration.minutes(15);

interface APIStackProps extends StackProps {
  config: EnvConfig;
  version: string | undefined;
}

export class APIStack extends Stack {
  readonly vpc: ec2.IVpc;

  constructor(scope: Construct, id: string, props: APIStackProps) {
    super(scope, id, props);

    const awsAccount = props.env?.account;
    if (!awsAccount) throw new Error("Missing AWS account");

    //-------------------------------------------
    // Secrets
    //-------------------------------------------
    const secrets = getSecrets(this, props.config);

    const slackNotification = setupSlackNotifSnsTopic(this, props.config);

    //-------------------------------------------
    // VPC + NAT Gateway
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

    //-------------------------------------------
    // Application-wide feature flags
    //-------------------------------------------
    const { appConfigAppId, appConfigConfigId, cxsWithEnhancedCoverageFeatureFlag } =
      createAppConfigStack(this, { config: props.config });

    //-------------------------------------------
    // Aurora Database for backend data
    //-------------------------------------------

    // create database credentials
    const dbUsername = props.config.dbUsername;
    const dbName = props.config.dbName;
    const dbClusterName = "api-cluster";
    const dbCredsSecret = new secret.Secret(this, "DBCreds", {
      secretName: `DBCreds`,
      generateSecretString: {
        secretStringTemplate: JSON.stringify({
          username: dbUsername,
        }),
        excludePunctuation: true,
        includeSpace: false,
        generateStringKey: "password",
      },
    });
    const dbCreds = rds.Credentials.fromSecret(dbCredsSecret);
    // aurora serverlessv2 db
    const dbCluster = new rds.DatabaseCluster(this, "APIDB", {
      engine: rds.DatabaseClusterEngine.auroraPostgres({
        version: rds.AuroraPostgresEngineVersion.VER_14_4,
      }),
      instanceProps: { vpc: this.vpc, instanceType: new InstanceType("serverless") },
      credentials: dbCreds,
      defaultDatabaseName: dbName,
      clusterIdentifier: dbClusterName,
      storageEncrypted: true,
    });
    const minDBCap = this.isProd(props) ? 2 : 0.5;
    const maxDBCap = this.isProd(props) ? 16 : 2;
    Aspects.of(dbCluster).add({
      visit(node) {
        if (node instanceof rds.CfnDBCluster) {
          node.serverlessV2ScalingConfiguration = {
            minCapacity: minDBCap,
            maxCapacity: maxDBCap,
          };
        }
      },
    });
    this.addDBClusterPerformanceAlarms(dbCluster, dbClusterName, slackNotification?.alarmAction);

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
    // table for sidechain FHIR converter key management
    const dynamoSidechainKeysConstructName = "SidechainFHIRConverterKeys";
    let dynamoDBSidechainKeysTable: dynamodb.Table | undefined = undefined;
    if (!isSandbox(props.config)) {
      dynamoDBSidechainKeysTable = new dynamodb.Table(this, dynamoSidechainKeysConstructName, {
        partitionKey: { name: "apiKey", type: dynamodb.AttributeType.STRING },
        replicationRegions: this.isProd(props) ? ["us-east-1"] : ["ca-central-1"],
        replicationTimeout: Duration.hours(3),
        encryption: dynamodb.TableEncryption.AWS_MANAGED,
        pointInTimeRecovery: true,
      });
      this.addDynamoPerformanceAlarms(
        dynamoDBSidechainKeysTable,
        dynamoSidechainKeysConstructName,
        slackNotification?.alarmAction
      );
    }

    //-------------------------------------------
    // Multi-purpose bucket
    //-------------------------------------------
    const generalBucket = new s3.Bucket(this, "GeneralBucket", {
      bucketName: props.config.generalBucketName,
      publicReadAccess: false,
      encryption: s3.BucketEncryption.S3_MANAGED,
    });

    //-------------------------------------------
    // S3 bucket for Medical Documents
    //-------------------------------------------
    const medicalDocumentsBucket = new s3.Bucket(this, "APIMedicalDocumentsBucket", {
      bucketName: props.config.medicalDocumentsBucketName,
      publicReadAccess: false,
      encryption: s3.BucketEncryption.S3_MANAGED,
    });

    //-------------------------------------------
    // S3 bucket for Medical Document Uploads
    //-------------------------------------------
    const medicalDocumentsUploadBucket = new s3.Bucket(this, "APIMedicalDocumentsUploadBucket", {
      bucketName: props.config.medicalDocumentsUploadBucketName,
      publicReadAccess: false,
      encryption: s3.BucketEncryption.S3_MANAGED,
    });

    //-------------------------------------------
    // FHIR Converter Service
    //-------------------------------------------
    let fhirConverter: ReturnType<typeof createFHIRConverterService> | undefined;
    if (!isSandbox(props.config)) {
      fhirConverter = createFHIRConverterService(
        this,
        props,
        this.vpc,
        slackNotification?.alarmAction
      );
    }

    const lambdaLayers = setupLambdasLayers(this);

    //-------------------------------------------
    // OPEN SEARCH Domains
    //-------------------------------------------
    const {
      queue: ccdaSearchQueue,
      searchDomain: ccdaSearchDomain,
      searchDomainUserName: ccdaSearchUserName,
      searchDomainSecret: ccdaSearchSecret,
      indexName: ccdaSearchIndexName,
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
    // FHIR CONNECTORS, initalize
    //-------------------------------------------
    const {
      queue: fhirConverterQueue,
      dlq: fhirConverterDLQ,
      bucket: fhirConverterBucket,
    } = fhirConverterConnector.createQueueAndBucket({
      stack: this,
      lambdaLayers,
      envType: props.config.environmentType,
      alarmSnsAction: slackNotification?.alarmAction,
    });

    // sidechain FHIR converter queue
    const {
      queue: sidechainFHIRConverterQueue,
      dlq: sidechainFHIRConverterDLQ,
      bucket: sidechainFHIRConverterBucket,
    } = sidechainFHIRConverterConnector.createQueueAndBucket({
      stack: this,
      lambdaLayers,
      envType: props.config.environmentType,
      alarmSnsAction: slackNotification?.alarmAction,
    });

    const existingSandboxSeedDataBucket = props.config.sandboxSeedDataBucketName
      ? s3.Bucket.fromBucketName(
          this,
          "APISandboxSeedDataBucket",
          props.config.sandboxSeedDataBucketName
        )
      : undefined;
    const sandboxSeedDataBucket = props.config.sandboxSeedDataBucketName
      ? existingSandboxSeedDataBucket ??
        new s3.Bucket(this, "APISandboxSeedDataBucket", {
          bucketName: props.config.sandboxSeedDataBucketName,
          publicReadAccess: false,
          encryption: s3.BucketEncryption.S3_MANAGED,
        })
      : undefined;

    const fhirServerQueue = fhirServerConnector.createConnector({
      envType: props.config.environmentType,
      stack: this,
      vpc: this.vpc,
      fhirConverterBucket: sandboxSeedDataBucket ?? sidechainFHIRConverterBucket,
      lambdaLayers,
      alarmSnsAction: slackNotification?.alarmAction,
    });

    const cdaToVisualizationLambda = this.setupCdaToVisualization({
      lambdaLayers,
      vpc: this.vpc,
      envType: props.config.environmentType,
      medicalDocumentsBucket,
      sandboxSeedDataBucket,
      sentryDsn: props.config.lambdasSentryDSN,
      alarmAction: slackNotification?.alarmAction,
    });

    const documentDownloaderLambda = this.setupDocumentDownloader({
      lambdaLayers,
      vpc: this.vpc,
      secrets,
      cwOrgCertificate: props.config.cwSecretNames.CW_ORG_CERTIFICATE,
      cwOrgPrivateKey: props.config.cwSecretNames.CW_ORG_PRIVATE_KEY,
      bucketName: medicalDocumentsBucket.bucketName,
      envType: props.config.environmentType,
      sentryDsn: props.config.lambdasSentryDSN,
    });

    let fhirToMedicalRecordLambda: Lambda | undefined = undefined;
    if (!isSandbox(props.config)) {
      fhirToMedicalRecordLambda = this.setupFhirToMedicalRecordLambda({
        lambdaLayers,
        vpc: this.vpc,
        medicalDocumentsBucket,
        envType: props.config.environmentType,
        sentryDsn: props.config.lambdasSentryDSN,
        alarmAction: slackNotification?.alarmAction,
      });
    }

    const bulkUrlSigningLambda = this.setupBulkUrlSigningLambda({
      lambdaLayers,
      vpc: this.vpc,
      bucketName: medicalDocumentsBucket.bucketName,
      fhirServerUrl: props.config.fhirServerUrl,
      envType: props.config.environmentType,
      sentryDsn: props.config.lambdasSentryDSN,
      alarmAction: slackNotification?.alarmAction,
      searchEndpoint: ccdaSearchDomain.domainEndpoint,
      searchIndex: ccdaSearchIndexName,
      searchUserName: ccdaSearchUserName,
      searchPassword: ccdaSearchSecret.secretValue.unsafeUnwrap(),
    });

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
    // const cqLinkPatientQueue = cwEnhancedQueryQueues?.linkPatientQueue;
    const cookieStore = cwEnhancedQueryQueues?.cookieStore;

    //-------------------------------------------
    // ECR + ECS + Fargate for Backend Servers
    //-------------------------------------------
    const {
      cluster,
      service: apiService,
      loadBalancerAddress: apiLoadBalancerAddress,
      serverAddress: apiServerUrl,
    } = createAPIService(
      this,
      props,
      secrets,
      this.vpc,
      dbCredsSecret,
      dynamoDBTokenTable,
      slackNotification?.alarmAction,
      dnsZones,
      props.config.fhirServerUrl,
      fhirServerQueue?.queueUrl,
      fhirConverterQueue.queueUrl,
      fhirConverter ? `http://${fhirConverter.address}` : undefined,
      sidechainFHIRConverterQueue,
      sidechainFHIRConverterDLQ,
      cdaToVisualizationLambda,
      documentDownloaderLambda,
      medicalDocumentsUploadBucket,
      fhirToMedicalRecordLambda,
      bulkUrlSigningLambda,
      ccdaSearchQueue,
      ccdaSearchDomain.domainEndpoint,
      { userName: ccdaSearchUserName, secret: ccdaSearchSecret },
      ccdaSearchIndexName,
      {
        appId: appConfigAppId,
        configId: appConfigConfigId,
        cxsWithEnhancedCoverageFeatureFlag,
      },
      // cqLinkPatientQueue
      cookieStore
    );

    // Access grant for Aurora DB
    dbCluster.connections.allowDefaultPortFrom(apiService.service);

    // setup a private link so the API can talk to the NLB
    const link = new apig.VpcLink(this, "link", {
      targets: [apiService.loadBalancer],
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
    fhirServerQueue &&
      provideAccessToQueue({
        accessType: "send",
        queue: fhirServerQueue,
        resource: apiService.service.taskDefinition.taskRole,
      });
    const fhirConverterLambda = fhirServerQueue?.queueUrl
      ? fhirConverterConnector.createLambda({
          envType: props.config.environmentType,
          stack: this,
          lambdaLayers,
          vpc: this.vpc,
          sourceQueue: fhirConverterQueue,
          destinationQueue: fhirServerQueue,
          dlq: fhirConverterDLQ,
          fhirConverterBucket,
          conversionResultQueueUrl: fhirServerQueue.queueUrl,
          apiServiceDnsAddress: apiLoadBalancerAddress,
          alarmSnsAction: slackNotification?.alarmAction,
        })
      : undefined;

    // sidechain FHIR converter
    const sidechainFHIRConverterLambda = fhirServerQueue?.queueUrl
      ? sidechainFHIRConverterConnector.createLambda({
          envType: props.config.environmentType,
          stack: this,
          lambdaLayers,
          vpc: this.vpc,
          sourceQueue: sidechainFHIRConverterQueue,
          destinationQueue: fhirServerQueue,
          dlq: sidechainFHIRConverterDLQ,
          fhirConverterBucket: sidechainFHIRConverterBucket,
          apiServiceDnsAddress: apiLoadBalancerAddress,
          alarmSnsAction: slackNotification?.alarmAction,
          dynamoDBSidechainKeysTable,
        })
      : undefined;

    // Access grant for medical documents bucket
    sandboxSeedDataBucket &&
      sandboxSeedDataBucket.grantReadWrite(apiService.taskDefinition.taskRole);
    medicalDocumentsBucket.grantReadWrite(apiService.taskDefinition.taskRole);
    medicalDocumentsBucket.grantReadWrite(documentDownloaderLambda);
    medicalDocumentsBucket.grantReadWrite(bulkUrlSigningLambda);
    fhirConverterLambda && medicalDocumentsBucket.grantRead(fhirConverterLambda);
    sidechainFHIRConverterLambda && medicalDocumentsBucket.grantRead(sidechainFHIRConverterLambda);

    createDocQueryChecker({
      lambdaLayers,
      stack: this,
      vpc: this.vpc,
      apiAddress: apiLoadBalancerAddress,
      alarmSnsAction: slackNotification?.alarmAction,
    });

    // cqLinkPatientQueue &&
    cookieStore &&
      cwEnhancedCoverageConnector.setupLambdas({
        stack: this,
        vpc: this.vpc,
        lambdaLayers,
        envType: props.config.environmentType,
        secrets,
        apiAddress: apiLoadBalancerAddress,
        bucket: generalBucket,
        alarmSnsAction: slackNotification?.alarmAction,
        // linkPatientQueue: cqLinkPatientQueue,
        cookieStore,
      });

    //-------------------------------------------
    // API Gateway
    //-------------------------------------------

    // Create the API Gateway
    // example from https://bobbyhadz.com/blog/aws-cdk-api-gateway-example
    const api = new apig.RestApi(this, "api", {
      description: "Metriport API Gateway",
      defaultIntegration: integration,
      defaultCorsPreflightOptions: {
        allowOrigins: ["*"],
        allowHeaders: ["*"],
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

    this.setupTestLambda(lambdaLayers, props.config.environmentType, props.config.lambdasSentryDSN);

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

    // WEBHOOKS
    const webhookResource = api.root.addResource("webhook");

    documentUploader.createLambda({
      lambdaLayers,
      stack: this,
      vpc: this.vpc,
      apiService,
      envType: props.config.environmentType,
      medicalDocumentsBucket,
      medicalDocumentsUploadBucket,
      sentryDsn: props.config.lambdasSentryDSN,
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

    //-------------------------------------------
    // IHE API Gateway
    //-------------------------------------------
    if (props.config.iheGateway) {
      createIHEStack(this, {
        config: props.config,
        vpc: this.vpc,
        alarmAction: slackNotification?.alarmAction,
        lambdaLayers,
        publicZone,
      });
    }

    createScheduledAPIQuotaChecker({
      stack: this,
      lambdaLayers,
      vpc: this.vpc,
      apiAddress: apiLoadBalancerAddress,
    });

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

  private setupTestLambda(
    lambdaLayers: LambdaLayers,
    envType: EnvType,
    sentryDsn: string | undefined
  ) {
    return createLambda({
      stack: this,
      name: "Tester",
      layers: [lambdaLayers.shared],
      vpc: this.vpc,
      subnets: this.vpc.privateSubnets,
      entry: "tester",
      envType,
      envVars: {
        ...(sentryDsn ? { SENTRY_DSN: sentryDsn } : {}),
      },
      architecture: lambda.Architecture.ARM_64,
    });
  }

  private setupGarminWebhookAuth(ownProps: {
    lambdaLayers: LambdaLayers;
    baseResource: apig.Resource;
    vpc: ec2.IVpc;
    fargateService: ecs_patterns.NetworkLoadBalancedFargateService;
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
    fargateService: ecs_patterns.NetworkLoadBalancedFargateService;
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
    fargateService: ecs_patterns.NetworkLoadBalancedFargateService;
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
    fargateService: ecs_patterns.NetworkLoadBalancedFargateService;
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

  private setupCdaToVisualization(ownProps: {
    lambdaLayers: LambdaLayers;
    vpc: ec2.IVpc;
    envType: EnvType;
    medicalDocumentsBucket: s3.Bucket;
    sandboxSeedDataBucket: s3.IBucket | undefined;
    sentryDsn: string | undefined;
    alarmAction: SnsAction | undefined;
  }): Lambda {
    const {
      lambdaLayers,
      vpc,
      sentryDsn,
      envType,
      alarmAction,
      medicalDocumentsBucket,
      sandboxSeedDataBucket,
    } = ownProps;

    const cdaToVisualizationLambda = createLambda({
      stack: this,
      name: "CdaToVisualization",
      runtime: lambda.Runtime.NODEJS_16_X,
      entry: "cda-to-visualization",
      envType,
      envVars: {
        CDA_TO_VIS_TIMEOUT_MS: CDA_TO_VIS_TIMEOUT.toMilliseconds().toString(),
        ...(sentryDsn ? { SENTRY_DSN: sentryDsn } : {}),
      },
      layers: [lambdaLayers.shared, lambdaLayers.chromium],
      memory: 1024,
      timeout: CDA_TO_VIS_TIMEOUT,
      vpc,
      alarmSnsAction: alarmAction,
    });

    medicalDocumentsBucket.grantReadWrite(cdaToVisualizationLambda);

    if (sandboxSeedDataBucket) {
      sandboxSeedDataBucket.grantReadWrite(cdaToVisualizationLambda);
    }

    return cdaToVisualizationLambda;
  }

  /**
   * We are intentionally not setting an alarm action for this lambda, as many issues
   * may be caused outside of our system. To eliminate noise, we will not alarm on this
   * lambda.
   */
  private setupDocumentDownloader(ownProps: {
    lambdaLayers: LambdaLayers;
    vpc: ec2.IVpc;
    secrets: Secrets;
    cwOrgCertificate: string;
    cwOrgPrivateKey: string;
    bucketName: string | undefined;
    envType: EnvType;
    sentryDsn: string | undefined;
  }): Lambda {
    const {
      lambdaLayers,
      vpc,
      secrets,
      cwOrgCertificate,
      cwOrgPrivateKey,
      bucketName,
      envType,
      sentryDsn,
    } = ownProps;

    const documentDownloaderLambda = createLambda({
      stack: this,
      name: "DocumentDownloader",
      runtime: lambda.Runtime.NODEJS_18_X,
      entry: "document-downloader",
      envType,
      envVars: {
        CW_ORG_CERTIFICATE: cwOrgCertificate,
        CW_ORG_PRIVATE_KEY: cwOrgPrivateKey,
        ...(bucketName && {
          MEDICAL_DOCUMENTS_BUCKET_NAME: bucketName,
        }),
        ...(sentryDsn ? { SENTRY_DSN: sentryDsn } : {}),
      },
      layers: [lambdaLayers.shared],
      memory: 512,
      timeout: Duration.minutes(5),
      vpc,
    });

    // granting secrets read access to lambda
    const cwOrgCertificateKey = "CW_ORG_CERTIFICATE";
    if (!secrets[cwOrgCertificateKey]) {
      throw new Error(`${cwOrgCertificateKey} is not defined in config`);
    }
    secrets[cwOrgCertificateKey].grantRead(documentDownloaderLambda);

    const cwOrgPrivateKeyKey = "CW_ORG_PRIVATE_KEY";
    if (!secrets[cwOrgPrivateKeyKey]) {
      throw new Error(`${cwOrgPrivateKeyKey} is not defined in config`);
    }
    secrets[cwOrgPrivateKeyKey].grantRead(documentDownloaderLambda);

    return documentDownloaderLambda;
  }

  private setupBulkUrlSigningLambda(ownProps: {
    lambdaLayers: LambdaLayers;
    vpc: ec2.IVpc;
    bucketName: string | undefined;
    fhirServerUrl: string | undefined;
    envType: EnvType;
    sentryDsn: string | undefined;
    alarmAction: SnsAction | undefined;
    searchEndpoint: string | undefined;
    searchIndex: string | undefined;
    searchUserName: string | undefined;
    searchPassword: string | undefined;
  }): Lambda {
    const {
      lambdaLayers,
      vpc,
      bucketName,
      fhirServerUrl,
      sentryDsn,
      alarmAction,
      envType,
      searchEndpoint,
      searchIndex,
      searchUserName,
      searchPassword,
    } = ownProps;

    const bulkUrlSigningLambda = createLambda({
      stack: this,
      name: "BulkUrlSigning",
      runtime: lambda.Runtime.NODEJS_18_X,
      entry: "document-bulk-signer",
      envType,
      envVars: {
        ...(bucketName && {
          MEDICAL_DOCUMENTS_BUCKET_NAME: bucketName,
          FHIR_SERVER_URL: fhirServerUrl,
          SEARCH_ENDPOINT: searchEndpoint,
          SEARCH_INDEX: searchIndex,
          SEARCH_USERNAME: searchUserName,
          SEARCH_PASSWORD: searchPassword,
        }),
        ...(sentryDsn ? { SENTRY_DSN: sentryDsn } : {}),
      },
      layers: [lambdaLayers.shared],
      memory: 512,
      timeout: Duration.minutes(5),
      vpc,
      alarmSnsAction: alarmAction,
    });

    return bulkUrlSigningLambda;
  }

  private setupFhirToMedicalRecordLambda(ownProps: {
    lambdaLayers: LambdaLayers;
    vpc: ec2.IVpc;
    medicalDocumentsBucket: s3.Bucket;
    envType: EnvType;
    sentryDsn: string | undefined;
    alarmAction: SnsAction | undefined;
  }): Lambda {
    const { lambdaLayers, vpc, sentryDsn, envType, alarmAction, medicalDocumentsBucket } = ownProps;

    const lambdaTimeout = MAXIMUM_LAMBDA_TIMEOUT.minus(Duration.seconds(5));
    const axiosTimeout = lambdaTimeout.minus(Duration.seconds(5));

    const fhirToMedicalRecordLambda = createLambda({
      stack: this,
      name: "FhirToMedicalRecord",
      runtime: lambda.Runtime.NODEJS_16_X,
      entry: "fhir-to-medical-record",
      envType,
      envVars: {
        AXIOS_TIMEOUT_SECONDS: axiosTimeout.toSeconds().toString(),
        MEDICAL_DOCUMENTS_BUCKET_NAME: medicalDocumentsBucket.bucketName,
        PDF_CONVERT_TIMEOUT_MS: CDA_TO_VIS_TIMEOUT.toMilliseconds().toString(),
        ...(sentryDsn ? { SENTRY_DSN: sentryDsn } : {}),
      },
      layers: [lambdaLayers.shared, lambdaLayers.chromium],
      memory: 4096,
      timeout: lambdaTimeout,
      vpc,
      alarmSnsAction: alarmAction,
    });

    medicalDocumentsBucket.grantReadWrite(fhirToMedicalRecordLambda);

    return fhirToMedicalRecordLambda;
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

  private addDBClusterPerformanceAlarms(
    dbCluster: rds.DatabaseCluster,
    dbClusterName: string,
    alarmAction?: SnsAction
  ) {
    const memoryMetric = dbCluster.metricFreeableMemory();
    const memoryAlarm = memoryMetric.createAlarm(this, `${dbClusterName}FreeableMemoryAlarm`, {
      threshold: mbToBytes(150),
      evaluationPeriods: 1,
      comparisonOperator: cloudwatch.ComparisonOperator.LESS_THAN_OR_EQUAL_TO_THRESHOLD,
      treatMissingData: cloudwatch.TreatMissingData.NOT_BREACHING,
    });
    alarmAction && memoryAlarm.addAlarmAction(alarmAction);
    alarmAction && memoryAlarm.addOkAction(alarmAction);

    const storageMetric = dbCluster.metricFreeLocalStorage();
    const storageAlarm = storageMetric.createAlarm(this, `${dbClusterName}FreeLocalStorageAlarm`, {
      threshold: mbToBytes(250),
      evaluationPeriods: 1,
      comparisonOperator: cloudwatch.ComparisonOperator.LESS_THAN_OR_EQUAL_TO_THRESHOLD,
      treatMissingData: cloudwatch.TreatMissingData.NOT_BREACHING,
    });
    alarmAction && storageAlarm.addAlarmAction(alarmAction);
    alarmAction && storageAlarm.addOkAction(alarmAction);

    const cpuMetric = dbCluster.metricCPUUtilization();
    const cpuAlarm = cpuMetric.createAlarm(this, `${dbClusterName}CPUUtilizationAlarm`, {
      threshold: 90, // pct
      evaluationPeriods: 1,
      treatMissingData: cloudwatch.TreatMissingData.NOT_BREACHING,
    });
    alarmAction && cpuAlarm.addAlarmAction(alarmAction);
    alarmAction && cpuAlarm.addOkAction(alarmAction);

    const readIOPsMetric = dbCluster.metricVolumeReadIOPs();
    const rIOPSAlarm = readIOPsMetric.createAlarm(this, `${dbClusterName}VolumeReadIOPsAlarm`, {
      // https://docs.aws.amazon.com/AmazonRDS/latest/AuroraUserGuide/Aurora.AuroraMonitoring.Metrics.html
      threshold: 166, // BILLED IOPS, that's ~50_000 regular IOPS
      evaluationPeriods: 1,
      treatMissingData: cloudwatch.TreatMissingData.NOT_BREACHING,
    });
    alarmAction && rIOPSAlarm.addAlarmAction(alarmAction);
    alarmAction && rIOPSAlarm.addOkAction(alarmAction);

    const writeIOPsMetric = dbCluster.metricVolumeWriteIOPs();
    const wIOPSAlarm = writeIOPsMetric.createAlarm(this, `${dbClusterName}VolumeWriteIOPsAlarm`, {
      threshold: 50_000, // IOPS
      evaluationPeriods: 1,
      treatMissingData: cloudwatch.TreatMissingData.NOT_BREACHING,
    });
    alarmAction && wIOPSAlarm.addAlarmAction(alarmAction);
    alarmAction && wIOPSAlarm.addOkAction(alarmAction);
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
