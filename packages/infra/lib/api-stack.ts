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
import { SnsAction } from "aws-cdk-lib/aws-cloudwatch-actions";
import * as cognito from "aws-cdk-lib/aws-cognito";
import * as ec2 from "aws-cdk-lib/aws-ec2";
import { InstanceType } from "aws-cdk-lib/aws-ec2";
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
import * as fhirConverterConnector from "./api-stack/fhir-converter-connector";
import { createFHIRConverterService } from "./api-stack/fhir-converter-service";
import { TerminologyServerNestedStack } from "./api-stack/terminology-server-service";
import { createAppConfigStack } from "./app-config-stack";
import { EnvType } from "./env-type";
import { IHEGatewayV2LambdasNestedStack } from "./ihe-gateway-v2-stack";
import { CDA_TO_VIS_TIMEOUT, LambdasNestedStack } from "./lambdas-nested-stack";
import { PatientImportNestedStack } from "./patient-import-nested-stack";
import * as AppConfigUtils from "./shared/app-config";
import { DailyBackup } from "./shared/backup";
import { MAXIMUM_LAMBDA_TIMEOUT, addErrorAlarmToLambdaFunc, createLambda } from "./shared/lambda";
import { LambdaLayers } from "./shared/lambda-layers";
import { addDBClusterPerformanceAlarms } from "./shared/rds";
import { getSecrets } from "./shared/secrets";
import { provideAccessToQueue } from "./shared/sqs";
import { isProd, isSandbox } from "./shared/util";
import { wafRules } from "./shared/waf-rules";

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
    const { appConfigAppId, appConfigConfigId, appConfigEnvId, deploymentStrategyId } =
      createAppConfigStack({
        stack: this,
        props: { config: props.config },
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
      dbConfig.alarmThresholds,
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
        });
      }
    };

    const sandboxSeedDataBucket = isSandbox(props.config)
      ? getSandboxSeedDataBucket(props.config)
      : undefined;

    //-------------------------------------------
    // General lambdas
    //-------------------------------------------
    const {
      lambdaLayers,
      cdaToVisualizationLambda,
      documentDownloaderLambda,
      fhirToCdaConverterLambda,
      outboundPatientDiscoveryLambda,
      outboundDocumentQueryLambda,
      outboundDocumentRetrievalLambda,
      fhirToBundleLambda,
      fhirConverterConnector: {
        queue: fhirConverterQueue,
        dlq: fhirConverterDLQ,
        bucket: fhirConverterBucket,
      },
    } = new LambdasNestedStack(this, "LambdasNestedStack", {
      config: props.config,
      vpc: this.vpc,
      dbCluster,
      dbCredsSecret,
      secrets,
      medicalDocumentsBucket,
      sandboxSeedDataBucket,
      alarmAction: slackNotification?.alarmAction,
      appConfigEnvVars: {
        appId: appConfigAppId,
        configId: appConfigConfigId,
      },
    });

    const {
      importFileLambda: patientImportLambda,
      patientCreateLambda,
      patientQueryLambda,
    } = new PatientImportNestedStack(this, "PatientImportNestedStack", {
      config: props.config,
      lambdaLayers,
      vpc: this.vpc,
      alarmAction: slackNotification?.alarmAction,
    });

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

    let fhirToMedicalRecordLambda: Lambda | undefined = undefined;
    if (!isSandbox(props.config)) {
      fhirToMedicalRecordLambda = this.setupFhirToMedicalRecordLambda({
        lambdaLayers,
        vpc: this.vpc,
        medicalDocumentsBucket,
        envType: props.config.environmentType,
        dashUrl: props.config.dashUrl,
        sentryDsn: props.config.lambdasSentryDSN,
        alarmAction: slackNotification?.alarmAction,
        appConfigEnvVars: {
          appId: appConfigAppId,
          configId: appConfigConfigId,
        },
        bedrock: props.config.bedrock,
        ...props.config.fhirToMedicalLambda,
      });
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
      patientImportLambda,
      generalBucket,
      conversionBucket: fhirConverterBucket,
      medicalDocumentsUploadBucket,
      ehrResponsesBucket,
      fhirToMedicalRecordLambda,
      fhirToCdaConverterLambda,
      fhirToBundleLambda,
      searchIngestionQueue: ccdaSearchQueue,
      searchEndpoint: ccdaSearchDomain.domainEndpoint,
      searchAuth: { userName: ccdaSearchUserName, secret: ccdaSearchSecret },
      searchIndexName: ccdaSearchIndexName,
      appConfigEnvVars: {
        appId: appConfigAppId,
        configId: appConfigConfigId,
        envId: appConfigEnvId,
        deploymentStrategyId: deploymentStrategyId,
      },
      cookieStore,
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
    const fhirConverterLambda = fhirConverterConnector.createLambda({
      envType: props.config.environmentType,
      stack: this,
      lambdaLayers,
      vpc: this.vpc,
      sourceQueue: fhirConverterQueue,
      dlq: fhirConverterDLQ,
      fhirConverterBucket,
      medicalDocumentsBucket,
      fhirServerUrl: props.config.fhirServerUrl,
      apiServiceDnsAddress: apiDirectUrl,
      alarmSnsAction: slackNotification?.alarmAction,
    });

    // Add ENV after the API service is created
    fhirToMedicalRecordLambda?.addEnvironment("API_URL", `http://${apiDirectUrl}`);
    outboundPatientDiscoveryLambda.addEnvironment("API_URL", `http://${apiDirectUrl}`);
    outboundDocumentQueryLambda.addEnvironment("API_URL", `http://${apiDirectUrl}`);
    outboundDocumentRetrievalLambda.addEnvironment("API_URL", `http://${apiDirectUrl}`);
    fhirToBundleLambda.addEnvironment("API_URL", `http://${apiDirectUrl}`);
    patientCreateLambda.addEnvironment("API_URL", `http://${apiDirectUrl}`);
    patientQueryLambda.addEnvironment("API_URL", `http://${apiDirectUrl}`);

    // TODO move this to each place where it's used
    // Access grant for medical documents bucket
    sandboxSeedDataBucket &&
      sandboxSeedDataBucket.grantReadWrite(apiService.taskDefinition.taskRole);
    medicalDocumentsBucket.grantReadWrite(apiService.taskDefinition.taskRole);
    medicalDocumentsBucket.grantReadWrite(documentDownloaderLambda);
    fhirConverterLambda && medicalDocumentsBucket.grantRead(fhirConverterLambda);

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
      props.config.lambdasSentryDSN
    );

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
      searchEndpoint: ccdaSearchDomain.domainEndpoint,
      searchIndex: ccdaSearchIndexName,
      searchUserName: ccdaSearchUserName,
      searchPassword: ccdaSearchSecret.secretValue.unsafeUnwrap(),
      apiTaskRole: apiService.service.taskDefinition.taskRole,
      apiAddress: apiDirectUrl,
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
        API_URL: apiAddress,
        ...(sentryDsn ? { SENTRY_DSN: sentryDsn } : {}),
      },
      architecture: lambda.Architecture.ARM_64,
    });
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
    nodeRuntimeArn: string;
    lambdaLayers: LambdaLayers;
    vpc: ec2.IVpc;
    medicalDocumentsBucket: s3.Bucket;
    envType: EnvType;
    dashUrl: string;
    sentryDsn: string | undefined;
    alarmAction: SnsAction | undefined;
    appConfigEnvVars: {
      appId: string;
      configId: string;
    };
    bedrock: { modelId: string; region: string; anthropicVersion: string } | undefined;
  }): Lambda {
    const {
      nodeRuntimeArn,
      lambdaLayers,
      vpc,
      sentryDsn,
      envType,
      dashUrl,
      alarmAction,
      medicalDocumentsBucket,
      appConfigEnvVars,
      bedrock,
    } = ownProps;

    const lambdaTimeout = MAXIMUM_LAMBDA_TIMEOUT.minus(Duration.seconds(5));
    const axiosTimeout = lambdaTimeout.minus(Duration.seconds(5));

    const fhirToMedicalRecordLambda = createLambda({
      stack: this,
      name: "FhirToMedicalRecord",
      runtime: lambda.Runtime.NODEJS_16_X,
      // TODO https://github.com/metriport/metriport-internal/issues/1672
      runtimeManagementMode: lambda.RuntimeManagementMode.manual(nodeRuntimeArn),
      entry: "fhir-to-medical-record",
      envType,
      envVars: {
        AXIOS_TIMEOUT_SECONDS: axiosTimeout.toSeconds().toString(),
        MEDICAL_DOCUMENTS_BUCKET_NAME: medicalDocumentsBucket.bucketName,
        PDF_CONVERT_TIMEOUT_MS: CDA_TO_VIS_TIMEOUT.toMilliseconds().toString(),
        APPCONFIG_APPLICATION_ID: appConfigEnvVars.appId,
        APPCONFIG_CONFIGURATION_ID: appConfigEnvVars.configId,
        ...(bedrock && {
          // API_URL set on the api-stack after the OSS API is created
          DASH_URL: dashUrl,
          BEDROCK_REGION: bedrock?.region,
          BEDROCK_VERSION: bedrock?.anthropicVersion,
          AI_BRIEF_MODEL_ID: bedrock?.modelId,
        }),
        ...(sentryDsn ? { SENTRY_DSN: sentryDsn } : {}),
      },
      layers: [lambdaLayers.shared, lambdaLayers.chromium],
      memory: 4096,
      timeout: lambdaTimeout,
      isEnableInsights: true,
      vpc,
      alarmSnsAction: alarmAction,
    });

    AppConfigUtils.allowReadConfig({
      scope: this,
      resourceName: "FhirToMrLambda",
      resourceRole: fhirToMedicalRecordLambda.role,
      appConfigResources: ["*"],
    });

    medicalDocumentsBucket.grantReadWrite(fhirToMedicalRecordLambda);

    const bedrockPolicyStatement = new iam.PolicyStatement({
      actions: ["bedrock:InvokeModel"],
      resources: ["*"],
    });

    fhirToMedicalRecordLambda.addToRolePolicy(bedrockPolicyStatement);
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
