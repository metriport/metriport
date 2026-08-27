import {
  CfnOutput,
  Duration,
  Fn,
  RemovalPolicy,
  Stack,
  StackProps,
  aws_wafv2 as wafv2,
} from "aws-cdk-lib";
import * as cert from "aws-cdk-lib/aws-certificatemanager";
import { SnsAction } from "aws-cdk-lib/aws-cloudwatch-actions";
import * as dynamodb from "aws-cdk-lib/aws-dynamodb";
import * as ec2 from "aws-cdk-lib/aws-ec2";
import * as elbv2 from "aws-cdk-lib/aws-elasticloadbalancingv2";
import { LambdaTarget } from "aws-cdk-lib/aws-elasticloadbalancingv2-targets";
import * as globalaccelerator from "aws-cdk-lib/aws-globalaccelerator";
import * as ga_endpoints from "aws-cdk-lib/aws-globalaccelerator-endpoints";
import * as glue from "aws-cdk-lib/aws-glue";
import * as iam from "aws-cdk-lib/aws-iam";
import { Function as Lambda } from "aws-cdk-lib/aws-lambda";
import { SqsEventSource } from "aws-cdk-lib/aws-lambda-event-sources";
import * as logs from "aws-cdk-lib/aws-logs";
import * as r53 from "aws-cdk-lib/aws-route53";
import * as r53_targets from "aws-cdk-lib/aws-route53-targets";
import * as s3 from "aws-cdk-lib/aws-s3";
import * as sns from "aws-cdk-lib/aws-sns";
import { Queue } from "aws-cdk-lib/aws-sqs";
import { Construct } from "constructs";
import { getEHexEnvVars } from "../config/ehex-config";
import { EnvConfig } from "../config/env-config";
import { EnvType } from "./env-type";
import { getDocIdMappingTableName } from "./shareback-nested-stack/shareback-nested-stack";
import { createBucket } from "./shared/bucket";
import { createLambda } from "./shared/lambda";
import { LambdaLayers, setupLambdasLayers } from "./shared/lambda-layers";
import { getSecrets, Secrets } from "./shared/secrets";
import { QueueAndLambdaSettings } from "./shared/settings";
import { createQueue, provideAccessToQueue } from "./shared/sqs";
import { addDefaultMetricsToTargetGroup } from "./shared/target-group";

const posthogSecretKey = "POST_HOG_API_KEY_SECRET";

interface EhexStackProps extends StackProps {
  config: EnvConfig;
  version: string | undefined;
}

function settings() {
  const writeToS3LambdaTimeout = Duration.seconds(55);
  const writeToS3LambdaMaxBatchingWindow = Duration.seconds(30);
  const writeToS3: Omit<QueueAndLambdaSettings, "waitTime"> = {
    name: "EhexGatewayOutboundPatientDiscoveryWriteToS3",
    entry: "ehex/ehex-gateway-outbound-patient-discovery-write-to-s3",
    lambda: {
      memory: 1024,
      timeout: writeToS3LambdaTimeout,
    },
    queue: {
      alertMaxApproximateAgeOfOldestMessage: Duration.hours(2),
      alertMaxApproximateNumberOfMessagesVisible: 25_000,
      maxReceiveCount: 3,
      visibilityTimeout: Duration.seconds(writeToS3LambdaTimeout.toSeconds() * 2 + 1),
      createRetryLambda: false,
    },
    eventSource: {
      batchSize: 500,
      reportBatchItemFailures: true,
      maxConcurrency: 2,
      maxBatchingWindow: writeToS3LambdaMaxBatchingWindow,
    },
  };
  const waf = {
    maxRequestPerIpOver5MinutesRateLimit: 1_000_000,
  };
  return {
    writeToS3,
    waf,
  };
}

export class EhexStack extends Stack {
  constructor(scope: Construct, id: string, props: EhexStackProps) {
    super(scope, id, props);

    const eHexConfig = props.config.ehex;
    if (!eHexConfig) throw new Error("Missing Ehex configuration");

    const configEHexGw = props.config.ehexGateway;
    if (!configEHexGw) throw new Error("Missing Ehex gateway configuration");

    const vpcId = configEHexGw.vpcId;
    if (!vpcId) throw new Error("Missing VPC ID for Ehex stack");
    const vpc = ec2.Vpc.fromLookup(this, "APIVpc", { vpcId });

    this.terminationProtection = true;

    const auditLogsBucket = s3.Bucket.fromBucketName(
      this,
      "AuditLogsBucket",
      props.config.auditLogs.bucketName
    );

    const alertSnsAction = setupSlackNotifSnsTopic(this, props.config);

    //-------------------------------------------
    // Secrets
    //-------------------------------------------
    const secrets = getSecrets(this, props.config);

    //-------------------------------------------
    // Configuration validation
    //-------------------------------------------
    const ehexApiUrl = `${configEHexGw.subdomain}.${props.config.domain}`;

    const publicZone = r53.HostedZone.fromLookup(this, "Zone", {
      domainName: props.config.host,
    });

    const certificate = cert.Certificate.fromCertificateArn(
      this,
      "EhexCertificate",
      configEHexGw.certArn
    );

    // Trust store bucket - must be in the same region as the ALB for ALB Trust Store to work
    const trustStoreBucket = s3.Bucket.fromBucketName(
      this,
      "TruststoreBucket",
      configEHexGw.trustStoreBucketName
    );

    const medicalDocumentsBucket = s3.Bucket.fromBucketName(
      this,
      "APIMedicalDocumentsBucket",
      props.config.medicalDocumentsBucketName
    );

    //TODO remove this
    const generalBucket = s3.Bucket.fromBucketName(
      this,
      "GeneralBucket",
      props.config.generalBucketName
    );

    const lambdaLayers = setupLambdasLayers(this, true);

    //-------------------------------------------
    // Global Accelerator + ALB (mTLS + WAF) + Lambda
    // Architecture: Global Accelerator (static IPs) → ALB (mTLS + WAF) → Lambda
    //-------------------------------------------
    const { alb, accelerator } = this.setupAlbWithGlobalAccelerator({
      vpc,
      certificate,
      trustStoreBucket,
      trustStoreKey: configEHexGw.trustStoreKey,
      environmentType: props.config.environmentType,
    });

    // Route53 record pointing to Global Accelerator for static IP access
    new r53.ARecord(this, "EhexAPIDomainRecord", {
      recordName: ehexApiUrl,
      zone: publicZone,
      target: r53.RecordTarget.fromAlias(new r53_targets.GlobalAcceleratorTarget(accelerator)),
    });

    const posthogSecretName = props.config.analyticsSecretNames.POST_HOG_API_KEY_SECRET;

    const ehexRequestsBucket = createBucket(
      this,
      {
        bucketName: props.config.ehexRequestsBucketName,
        versioned: true,
      },
      "EhexRequestsBucket"
    );

    const featureFlagsTable = dynamodb.Table.fromTableArn(
      this,
      "FeatureFlagsTableForEhex",
      eHexConfig.featureFlagsTableArn
    );

    const docIdMappingTable = dynamodb.Table.fromTableName(
      this,
      "DocIdMappingTableForEhex",
      getDocIdMappingTableName(props.config)
    );

    const inboundPatientDiscoveryLambda = this.setupInboundPatientDiscoveryLambda({
      props,
      eHexConfig,
      lambdaLayers,
      vpc,
      secrets,
      posthogSecretName,
      alertSnsAction,
      ehexRequestsBucket,
      generalBucket,
      auditLogsBucket,
    });

    const inboundDocumentQueryLambda = this.setupInboundDocumentQueryLambda({
      props,
      eHexConfig,
      lambdaLayers,
      vpc,
      secrets,
      medicalDocumentsBucket,
      posthogSecretName,
      alertSnsAction,
      ehexRequestsBucket,
      generalBucket,
      docIdMappingTable,
      auditLogsBucket,
    });

    const inboundDocumentRetrievalLambda = this.setupInboundDocumentRetrievalLambda({
      props,
      eHexConfig,
      lambdaLayers,
      vpc,
      secrets,
      medicalDocumentsBucket,
      posthogSecretName,
      alertSnsAction,
      ehexRequestsBucket,
      generalBucket,
      docIdMappingTable,
      auditLogsBucket,
    });

    this.setupAlbLambdaRoutes({
      alb,
      inboundPatientDiscoveryLambda,
      inboundDocumentQueryLambda,
      inboundDocumentRetrievalLambda,
      alertSnsAction,
    });

    const { lambda: writeToS3LambdaOutboundPD, queue: writeToS3QueueOutboundPD } =
      this.setupWriteToS3OutboundPD({
        lambdaLayers,
        vpc,
        envType: props.config.environmentType,
        sentryDsn: props.config.lambdasSentryDSN,
        alertAction: alertSnsAction,
      });

    const ehexResponsesBucket = createBucket(
      this,
      {
        bucketName: props.config.ehexResponsesBucketName,
      },
      "EhexResponsesBucket"
    );

    const ehexParsedResponsesBucket = createBucket(
      this,
      {
        bucketName: props.config.ehexParsedResponsesBucketName,
      },
      "EhexParsedResponsesBucket"
    );

    ehexParsedResponsesBucket.grantWrite(writeToS3LambdaOutboundPD);

    this.createParsedResponseTables(ehexParsedResponsesBucket);
    this.createParsedResponseProjectionTables(ehexParsedResponsesBucket);

    const outboundLambdaProps = {
      lambdaLayers,
      vpc,
      secrets,
      ehexOrgCertificate: eHexConfig.secretNames.EHEX_ORG_CERTIFICATE,
      ehexOrgPrivateKey: eHexConfig.secretNames.EHEX_ORG_PRIVATE_KEY,
      ehexOrgPrivateKeyPassword: eHexConfig.secretNames.EHEX_ORG_PRIVATE_KEY_PASSWORD,
      ehexOrgCertificateIntermediate: eHexConfig.secretNames.EHEX_ORG_CERTIFICATE_INTERMEDIATE,
      medicalDocumentsBucket,
      ehexTrustBundleBucket: trustStoreBucket,
      apiURL: props.config.loadBalancerDnsName,
      envType: props.config.environmentType,
      sentryDsn: props.config.lambdasSentryDSN,
    };

    const outboundPatientDiscoveryLambda = this.setupOutboundPatientDiscoveryLambda(
      { ...outboundLambdaProps, featureFlagsTable },
      props.config,
      eHexConfig,
      ehexResponsesBucket,
      ehexParsedResponsesBucket,
      auditLogsBucket,
      writeToS3QueueOutboundPD
    );
    const outboundDocumentQueryLambda = this.setupOutboundDocumentQueryLambda(
      outboundLambdaProps,
      props.config,
      eHexConfig,
      ehexResponsesBucket,
      auditLogsBucket
    );
    const outboundDocumentRetrievalLambda = this.setupOutboundDocumentRetrievalLambda(
      outboundLambdaProps,
      props.config,
      eHexConfig,
      ehexResponsesBucket,
      auditLogsBucket
    );

    const apiTaskRole = iam.Role.fromRoleArn(
      this,
      "ApiTaskRoleImported",
      eHexConfig.apiTaskRoleArn,
      {
        mutable: false,
      }
    );
    // Add explicit Lambda permissions for cross-stack role reference
    outboundPatientDiscoveryLambda.addPermission("AllowApiTaskRoleInvoke", {
      principal: apiTaskRole,
      action: "lambda:InvokeFunction",
    });
    outboundDocumentQueryLambda.addPermission("AllowApiTaskRoleInvoke", {
      principal: apiTaskRole,
      action: "lambda:InvokeFunction",
    });
    outboundDocumentRetrievalLambda.addPermission("AllowApiTaskRoleInvoke", {
      principal: apiTaskRole,
      action: "lambda:InvokeFunction",
    });

    //-------------------------------------------
    // Output
    //-------------------------------------------
    new CfnOutput(this, "EhexAlbDnsName", {
      description: "Ehex Application Load Balancer DNS Name",
      value: alb.loadBalancerDnsName,
    });
    new CfnOutput(this, "EhexGlobalAcceleratorDnsName", {
      description: "Ehex Global Accelerator DNS Name",
      value: accelerator.dnsName,
    });
  }

  private setupInboundDocumentQueryLambda({
    props,
    eHexConfig,
    lambdaLayers,
    vpc,
    secrets,
    medicalDocumentsBucket,
    posthogSecretName,
    alertSnsAction,
    ehexRequestsBucket,
    generalBucket,
    docIdMappingTable,
    auditLogsBucket,
  }: {
    props: EhexStackProps;
    eHexConfig: NonNullable<EnvConfig["ehex"]>;
    lambdaLayers: LambdaLayers;
    vpc: ec2.IVpc;
    secrets: Secrets;
    medicalDocumentsBucket: s3.IBucket;
    posthogSecretName: string | undefined;
    alertSnsAction?: SnsAction | undefined;
    ehexRequestsBucket: s3.IBucket;
    generalBucket: s3.IBucket;
    docIdMappingTable: dynamodb.ITable;
    auditLogsBucket: s3.IBucket;
  }): Lambda {
    const documentQueryLambda = createLambda({
      stack: this,
      name: "EhexInboundDocumentQuery",
      entry: "ehex/ehex-gateway-inbound-document-query",
      layers: [lambdaLayers.shared],
      memory: 1024,
      envType: props.config.environmentType,
      envVars: {
        AUDIT_LOGS_BUCKET_NAME: auditLogsBucket.bucketName,
        ...getEHexEnvVars(eHexConfig, props.config),
        MEDICAL_DOCUMENTS_BUCKET_NAME: props.config.medicalDocumentsBucketName,
        EHEX_REQUESTS_BUCKET_NAME: ehexRequestsBucket.bucketName,
        API_LB_ADDRESS: props.config.loadBalancerDnsName,
        DOC_ID_MAPPING_TABLE_NAME: docIdMappingTable.tableName,
        ...(props.config.engineeringCxId
          ? { ENGINEERING_CX_ID: props.config.engineeringCxId }
          : {}),
        ...(posthogSecretName ? { POST_HOG_API_KEY_SECRET: posthogSecretName } : {}),
        ...(props.config.lambdasSentryDSN ? { SENTRY_DSN: props.config.lambdasSentryDSN } : {}),
        //TODO remove this
        GENERAL_BUCKET_NAME: props.config.generalBucketName,
        DEBUG_MODE_ENABLED: "false",
      },
      vpc,
      alertSnsAction,
      version: props.version,
    });

    ehexRequestsBucket.grantReadWrite(documentQueryLambda);
    secrets[posthogSecretKey]?.grantRead(documentQueryLambda);
    medicalDocumentsBucket.grantReadWrite(documentQueryLambda);
    generalBucket.grantRead(documentQueryLambda);
    docIdMappingTable.grantReadWriteData(documentQueryLambda);
    // TODO ENG-1601 Remove this when we expose AuditLog as an async service
    auditLogsBucket.grantReadWrite(documentQueryLambda);

    return documentQueryLambda;
  }

  private setupInboundDocumentRetrievalLambda({
    props,
    eHexConfig,
    lambdaLayers,
    vpc,
    secrets,
    medicalDocumentsBucket,
    posthogSecretName,
    alertSnsAction,
    ehexRequestsBucket,
    generalBucket,
    docIdMappingTable,
    auditLogsBucket,
  }: {
    props: EhexStackProps;
    eHexConfig: NonNullable<EnvConfig["ehex"]>;
    lambdaLayers: LambdaLayers;
    vpc: ec2.IVpc;
    secrets: Secrets;
    medicalDocumentsBucket: s3.IBucket;
    posthogSecretName: string | undefined;
    alertSnsAction?: SnsAction | undefined;
    ehexRequestsBucket: s3.IBucket;
    generalBucket: s3.IBucket;
    docIdMappingTable: dynamodb.ITable;
    auditLogsBucket: s3.IBucket;
  }): Lambda {
    const documentRetrievalLambda = createLambda({
      stack: this,
      name: "EhexInboundDocumentRetrieval",
      entry: "ehex/ehex-gateway-inbound-document-retrieval",
      layers: [lambdaLayers.shared],
      memory: 1024,
      envType: props.config.environmentType,
      envVars: {
        AUDIT_LOGS_BUCKET_NAME: auditLogsBucket.bucketName,
        EHEX_REQUESTS_BUCKET_NAME: ehexRequestsBucket.bucketName,
        ...getEHexEnvVars(eHexConfig, props.config),
        MEDICAL_DOCUMENTS_BUCKET_NAME: props.config.medicalDocumentsBucketName,
        DOC_ID_MAPPING_TABLE_NAME: docIdMappingTable.tableName,
        ...(props.config.engineeringCxId
          ? { ENGINEERING_CX_ID: props.config.engineeringCxId }
          : {}),
        ...(posthogSecretName ? { POST_HOG_API_KEY_SECRET: posthogSecretName } : {}),
        ...(props.config.lambdasSentryDSN ? { SENTRY_DSN: props.config.lambdasSentryDSN } : {}),
        //TODO remove this
        GENERAL_BUCKET_NAME: props.config.generalBucketName,
        DEBUG_MODE_ENABLED: "false",
      },
      vpc,
      alertSnsAction,
      version: props.version,
    });

    ehexRequestsBucket.grantReadWrite(documentRetrievalLambda);
    secrets[posthogSecretKey]?.grantRead(documentRetrievalLambda);
    medicalDocumentsBucket.grantRead(documentRetrievalLambda);
    generalBucket.grantRead(documentRetrievalLambda);
    docIdMappingTable.grantReadWriteData(documentRetrievalLambda);
    // TODO ENG-1601 Remove this when we expose AuditLog as an async service
    auditLogsBucket.grantReadWrite(documentRetrievalLambda);

    return documentRetrievalLambda;
  }

  private setupInboundPatientDiscoveryLambda({
    props,
    eHexConfig,
    lambdaLayers,
    vpc,
    secrets,
    posthogSecretName,
    alertSnsAction,
    ehexRequestsBucket,
    generalBucket,
    auditLogsBucket,
  }: {
    props: EhexStackProps;
    eHexConfig: NonNullable<EnvConfig["ehex"]>;
    lambdaLayers: LambdaLayers;
    vpc: ec2.IVpc;
    secrets: Secrets;
    posthogSecretName: string | undefined;
    alertSnsAction?: SnsAction | undefined;
    ehexRequestsBucket: s3.IBucket;
    generalBucket: s3.IBucket;
    auditLogsBucket: s3.IBucket;
  }): Lambda {
    const patientDiscoveryLambda = createLambda({
      stack: this,
      name: "EhexInboundPatientDiscovery",
      entry: "ehex/ehex-gateway-inbound-patient-discovery",
      layers: [lambdaLayers.shared],
      memory: 512,
      envType: props.config.environmentType,
      envVars: {
        AUDIT_LOGS_BUCKET_NAME: auditLogsBucket.bucketName,
        EHEX_REQUESTS_BUCKET_NAME: ehexRequestsBucket.bucketName,
        ...getEHexEnvVars(eHexConfig, props.config),
        API_URL: props.config.loadBalancerDnsName,
        ...(props.config.engineeringCxId
          ? { ENGINEERING_CX_ID: props.config.engineeringCxId }
          : {}),
        ...(posthogSecretName ? { POST_HOG_API_KEY_SECRET: posthogSecretName } : {}),
        ...(props.config.lambdasSentryDSN ? { SENTRY_DSN: props.config.lambdasSentryDSN } : {}),
        //TODO remove this
        GENERAL_BUCKET_NAME: props.config.generalBucketName,
        DEBUG_MODE_ENABLED: "false",
      },
      vpc,
      alertSnsAction,
      version: props.version,
      isEnableInsights: true,
    });

    ehexRequestsBucket.grantReadWrite(patientDiscoveryLambda);
    secrets[posthogSecretKey]?.grantRead(patientDiscoveryLambda);
    generalBucket.grantRead(patientDiscoveryLambda);
    // TODO ENG-1601 Remove this when we expose AuditLog as an async service
    auditLogsBucket.grantReadWrite(patientDiscoveryLambda);

    return patientDiscoveryLambda;
  }

  private createParsedResponseTables(ehexParsedResponsesBucket: s3.Bucket) {
    new glue.CfnTable(this, "ehexParsedResponsesDebugTable", {
      catalogId: this.account,
      databaseName: "default",
      tableInput: {
        description: "Table used for debugging Ehex parsed responses",
        name: "ehex_parsed_responses_by_date",
        partitionKeys: [
          { name: "date", type: "string" },
          { name: "cx_id", type: "string" },
          { name: "patient_id", type: "string" },
          { name: "stage", type: "string" },
        ],
        storageDescriptor: {
          columns: [
            { name: "id", type: "string" },
            { name: "timestamp", type: "string" },
            { name: "requesttimestamp", type: "string" },
            { name: "responsetimestamp", type: "string" },
            { name: "gateway", type: "struct<url:string,oid:string,id:string>" },
            { name: "patientmatch", type: "string" },
            { name: "ehexgateway", type: "boolean" },
            {
              name: "operationoutcome",
              type: "struct<resourcetype:string,id:string,issue:array<struct<severity:string,code:string,details:struct<text:string>>>>",
            },
            { name: "_date", type: "string" },
            { name: "cxid", type: "string" },
            { name: "patientid", type: "string" },
            { name: "_stage", type: "string" },
          ],
          compressed: false,
          inputFormat: "org.apache.hadoop.mapred.TextInputFormat",
          outputFormat: "org.apache.hadoop.hive.ql.io.HiveIgnoreKeyTextOutputFormat",
          location: `s3://${ehexParsedResponsesBucket.bucketName}/`,
          serdeInfo: { serializationLibrary: "org.openx.data.jsonserde.JsonSerDe" },
        },
        tableType: "EXTERNAL_TABLE",
      },
    });
  }

  private createParsedResponseProjectionTables(ehexParsedResponsesBucket: s3.Bucket) {
    type PartitionKey = "date" | "cx_id" | "patient_id" | "stage";
    const partitionKeyMap: Record<
      PartitionKey,
      { parameters: Record<string, string>; partitionKey: { name: string; type: string } }
    > = {
      date: {
        parameters: {
          "projection.date.type": "date",
          "projection.date.format": "yyyy-MM-dd",
          "projection.date.range": "NOW-5YEARS,NOW+5YEARS",
          "projection.date.interval": "1",
          "projection.date.interval.unit": "DAYS",
        },
        partitionKey: { name: "date", type: "string" },
      },
      cx_id: {
        parameters: { "projection.cx_id.type": "injected" },
        partitionKey: { name: "cx_id", type: "string" },
      },
      patient_id: {
        parameters: { "projection.patient_id.type": "injected" },
        partitionKey: { name: "patient_id", type: "string" },
      },
      stage: {
        parameters: { "projection.stage.type": "injected" },
        partitionKey: { name: "stage", type: "string" },
      },
    };

    let parameters: Record<string, string> = {};
    const partitionKeys: { name: string; type: string }[] = [];
    const locationStrings: string[] = [];
    for (const [key, value] of Object.entries(partitionKeyMap)) {
      parameters = { ...parameters, ...value.parameters };
      partitionKeys.push(value.partitionKey);
      locationStrings.push(`${key}=\${${key}}`);
      new glue.CfnTable(this, `ehexParsedResponsesDebugTable_Detail=${key}`, {
        catalogId: this.account,
        databaseName: "default",
        tableInput: {
          description: `Table used for debugging Ehex parsed responses using partition projection for ${key}`,
          name: `ehex_parsed_responses_level_${key}`,
          partitionKeys: [...partitionKeys],
          storageDescriptor: {
            columns: [
              { name: "id", type: "string" },
              { name: "timestamp", type: "string" },
              { name: "requesttimestamp", type: "string" },
              { name: "responsetimestamp", type: "string" },
              { name: "gateway", type: "struct<url:string,oid:string,id:string>" },
              { name: "patientmatch", type: "string" },
              { name: "ehexgateway", type: "boolean" },
              {
                name: "operationoutcome",
                type: "struct<resourcetype:string,id:string,issue:array<struct<severity:string,code:string,details:struct<text:string>>>>",
              },
              { name: "_date", type: "string" },
              { name: "cxid", type: "string" },
              { name: "patientid", type: "string" },
              { name: "_stage", type: "string" },
            ],
            compressed: false,
            inputFormat: "org.apache.hadoop.mapred.TextInputFormat",
            outputFormat: "org.apache.hadoop.hive.ql.io.HiveIgnoreKeyTextOutputFormat",
            location: `s3://${ehexParsedResponsesBucket.bucketName}/`,
            serdeInfo: { serializationLibrary: "org.openx.data.jsonserde.JsonSerDe" },
          },
          parameters: {
            "projection.enabled": "true",
            ...parameters,
            "storage.location.template":
              `s3://${ehexParsedResponsesBucket.bucketName}/` + locationStrings.join("/") + "/",
          },
          tableType: "EXTERNAL_TABLE",
        },
      });
    }
  }

  private setupWriteToS3OutboundPD(ownProps: {
    lambdaLayers: LambdaLayers;
    vpc: ec2.IVpc;
    envType: EnvType;
    sentryDsn: string | undefined;
    alertAction: SnsAction | undefined;
  }): { lambda: Lambda; queue: Queue } {
    const { lambdaLayers, vpc, envType, sentryDsn, alertAction } = ownProps;
    const {
      name,
      entry,
      lambda: lambdaSettings,
      queue: queueSettings,
      eventSource: eventSourceSettings,
    } = settings().writeToS3;

    const queue = createQueue({
      ...queueSettings,
      stack: this,
      name,
      createDLQ: true,
      lambdaLayers: [lambdaLayers.shared],
      envType,
      alertSnsAction: alertAction,
    });

    const lambda = createLambda({
      ...lambdaSettings,
      stack: this,
      name,
      entry,
      envType,
      envVars: {
        ...(sentryDsn ? { SENTRY_DSN: sentryDsn } : {}),
      },
      layers: [lambdaLayers.shared],
      vpc,
      alertSnsAction: alertAction,
    });

    lambda.addEventSource(new SqsEventSource(queue, eventSourceSettings));

    return { lambda, queue };
  }

  private grantSecretsReadAccess(
    lambdaFunction: Lambda,
    secrets: Secrets,
    secretKeys: string[]
  ): void {
    secretKeys.forEach(key => {
      if (!secrets[key]) {
        throw new Error(`${key} is not defined in config`);
      }
      secrets[key]?.grantRead(lambdaFunction);
    });
  }

  private setupOutboundPatientDiscoveryLambda(
    ownProps: {
      lambdaLayers: LambdaLayers;
      vpc: ec2.IVpc;
      secrets: Secrets;
      ehexOrgCertificate: string | undefined;
      ehexOrgPrivateKey: string | undefined;
      ehexOrgPrivateKeyPassword: string | undefined;
      ehexOrgCertificateIntermediate: string | undefined;
      medicalDocumentsBucket: s3.IBucket;
      ehexTrustBundleBucket: s3.IBucket;
      apiURL: string;
      envType: EnvType;
      sentryDsn: string | undefined;
      featureFlagsTable: dynamodb.ITable;
    },
    config: EnvConfig,
    eHexConfig: NonNullable<EnvConfig["ehex"]>,
    ehexResponsesBucket: s3.Bucket,
    ehexParsedResponsesBucket: s3.Bucket,
    auditLogsBucket: s3.IBucket,
    writeToS3Queue: Queue
  ): Lambda {
    const {
      lambdaLayers,
      vpc,
      secrets,
      ehexOrgCertificate,
      ehexOrgPrivateKey,
      ehexOrgPrivateKeyPassword,
      ehexOrgCertificateIntermediate,
      medicalDocumentsBucket,
      ehexTrustBundleBucket,
      apiURL,
      envType,
      sentryDsn,
      featureFlagsTable,
    } = ownProps;

    const patientDiscoveryLambda = createLambda({
      stack: this,
      name: "EhexGatewayOutboundPatientDiscovery",
      entry: "ehex/ehex-gateway-outbound-patient-discovery",
      envType: envType,
      envVars: {
        AUDIT_LOGS_BUCKET_NAME: auditLogsBucket.bucketName,
        ...getEHexEnvVars(eHexConfig, config),
        ...(ehexOrgPrivateKey !== undefined && { EHEX_ORG_PRIVATE_KEY: ehexOrgPrivateKey }),
        ...(ehexOrgCertificate !== undefined && { EHEX_ORG_CERTIFICATE: ehexOrgCertificate }),
        ...(ehexOrgCertificateIntermediate !== undefined && {
          EHEX_ORG_CERTIFICATE_INTERMEDIATE: ehexOrgCertificateIntermediate,
        }),
        ...(ehexOrgPrivateKeyPassword !== undefined && {
          EHEX_ORG_PRIVATE_KEY_PASSWORD: ehexOrgPrivateKeyPassword,
        }),
        ...(ehexTrustBundleBucket !== undefined && {
          EHEX_TRUST_BUNDLE_BUCKET_NAME: ehexTrustBundleBucket.bucketName,
        }),
        API_URL: apiURL,
        MEDICAL_DOCUMENTS_BUCKET_NAME: medicalDocumentsBucket.bucketName,
        ...(sentryDsn ? { SENTRY_DSN: sentryDsn } : {}),
        EHEX_RESPONSES_BUCKET_NAME: ehexResponsesBucket.bucketName,
        EHEX_PARSED_RESPONSES_BUCKET_NAME: ehexParsedResponsesBucket.bucketName,
        WRITE_TO_S3_QUEUE_URL: writeToS3Queue.queueUrl,
        FEATURE_FLAGS_TABLE_NAME: featureFlagsTable.tableName,
        DEBUG_MODE_ENABLED: "false",
      },
      layers: [lambdaLayers.shared],
      memory: 1024,
      timeout: Duration.minutes(10),
      isEnableInsights: true,
      vpc,
    });

    provideAccessToQueue({
      accessType: "send",
      queue: writeToS3Queue,
      resource: patientDiscoveryLambda,
    });

    this.grantSecretsReadAccess(patientDiscoveryLambda, secrets, [
      "EHEX_ORG_CERTIFICATE",
      "EHEX_ORG_CERTIFICATE_INTERMEDIATE",
      "EHEX_ORG_PRIVATE_KEY",
      "EHEX_ORG_PRIVATE_KEY_PASSWORD",
    ]);

    ehexResponsesBucket.grantReadWrite(patientDiscoveryLambda);
    medicalDocumentsBucket.grantRead(patientDiscoveryLambda);
    ehexTrustBundleBucket.grantRead(patientDiscoveryLambda);
    // TODO ENG-1601 Remove this when we expose AuditLog as an async service
    auditLogsBucket.grantReadWrite(patientDiscoveryLambda);

    if (featureFlagsTable) {
      featureFlagsTable.grantReadData(patientDiscoveryLambda);
    }

    return patientDiscoveryLambda;
  }

  private setupOutboundDocumentQueryLambda(
    ownProps: {
      lambdaLayers: LambdaLayers;
      vpc: ec2.IVpc;
      secrets: Secrets;
      ehexOrgCertificate: string | undefined;
      ehexOrgPrivateKey: string | undefined;
      ehexOrgPrivateKeyPassword: string | undefined;
      ehexOrgCertificateIntermediate: string | undefined;
      ehexTrustBundleBucket: s3.IBucket;
      medicalDocumentsBucket: s3.IBucket;
      apiURL: string;
      envType: EnvType;
      sentryDsn: string | undefined;
    },
    config: EnvConfig,
    eHexConfig: NonNullable<EnvConfig["ehex"]>,
    ehexResponsesBucket: s3.Bucket,
    auditLogsBucket: s3.IBucket
  ): Lambda {
    const {
      lambdaLayers,
      vpc,
      secrets,
      ehexOrgCertificate,
      ehexOrgPrivateKey,
      ehexOrgPrivateKeyPassword,
      ehexOrgCertificateIntermediate,
      ehexTrustBundleBucket,
      medicalDocumentsBucket,
      apiURL,
      envType,
      sentryDsn,
    } = ownProps;

    const documentQueryLambda = createLambda({
      stack: this,
      name: "EhexGatewayOutboundDocumentQuery",
      entry: "ehex/ehex-gateway-outbound-document-query",
      envType: envType,
      envVars: {
        AUDIT_LOGS_BUCKET_NAME: auditLogsBucket.bucketName,
        ...getEHexEnvVars(eHexConfig, config),
        ...(ehexOrgPrivateKey !== undefined && { EHEX_ORG_PRIVATE_KEY: ehexOrgPrivateKey }),
        ...(ehexOrgCertificate !== undefined && { EHEX_ORG_CERTIFICATE: ehexOrgCertificate }),
        ...(ehexOrgCertificateIntermediate !== undefined && {
          EHEX_ORG_CERTIFICATE_INTERMEDIATE: ehexOrgCertificateIntermediate,
        }),
        ...(ehexOrgPrivateKeyPassword !== undefined && {
          EHEX_ORG_PRIVATE_KEY_PASSWORD: ehexOrgPrivateKeyPassword,
        }),
        ...(ehexTrustBundleBucket !== undefined && {
          EHEX_TRUST_BUNDLE_BUCKET_NAME: ehexTrustBundleBucket.bucketName,
        }),
        API_URL: apiURL,
        ...(sentryDsn ? { SENTRY_DSN: sentryDsn } : {}),
        MEDICAL_DOCUMENTS_BUCKET_NAME: medicalDocumentsBucket.bucketName,
        EHEX_RESPONSES_BUCKET_NAME: ehexResponsesBucket.bucketName,
        DEBUG_MODE_ENABLED: "false",
      },
      layers: [lambdaLayers.shared],
      memory: 1024,
      timeout: Duration.minutes(10),
      vpc,
    });

    this.grantSecretsReadAccess(documentQueryLambda, secrets, [
      "EHEX_ORG_CERTIFICATE",
      "EHEX_ORG_CERTIFICATE_INTERMEDIATE",
      "EHEX_ORG_PRIVATE_KEY",
      "EHEX_ORG_PRIVATE_KEY_PASSWORD",
    ]);

    ehexResponsesBucket.grantReadWrite(documentQueryLambda);
    medicalDocumentsBucket.grantRead(documentQueryLambda);
    ehexTrustBundleBucket.grantRead(documentQueryLambda);
    // TODO ENG-1601 Remove this when we expose AuditLog as an async service
    auditLogsBucket.grantReadWrite(documentQueryLambda);

    return documentQueryLambda;
  }

  private setupOutboundDocumentRetrievalLambda(
    ownProps: {
      lambdaLayers: LambdaLayers;
      vpc: ec2.IVpc;
      secrets: Secrets;
      ehexOrgCertificate: string | undefined;
      ehexOrgPrivateKey: string | undefined;
      ehexOrgPrivateKeyPassword: string | undefined;
      ehexOrgCertificateIntermediate: string | undefined;
      ehexTrustBundleBucket: s3.IBucket;
      medicalDocumentsBucket: s3.IBucket;
      apiURL: string;
      envType: EnvType;
      sentryDsn: string | undefined;
    },
    config: EnvConfig,
    eHexConfig: NonNullable<EnvConfig["ehex"]>,
    ehexResponsesBucket: s3.Bucket,
    auditLogsBucket: s3.IBucket
  ): Lambda {
    const {
      lambdaLayers,
      vpc,
      secrets,
      ehexOrgCertificate,
      ehexOrgPrivateKey,
      ehexOrgPrivateKeyPassword,
      ehexOrgCertificateIntermediate,
      ehexTrustBundleBucket,
      medicalDocumentsBucket,
      apiURL,
      envType,
      sentryDsn,
    } = ownProps;

    const documentRetrievalLambda = createLambda({
      stack: this,
      name: "EhexGatewayOutboundDocumentRetrieval",
      entry: "ehex/ehex-gateway-outbound-document-retrieval",
      envType: envType,
      envVars: {
        AUDIT_LOGS_BUCKET_NAME: auditLogsBucket.bucketName,
        ...getEHexEnvVars(eHexConfig, config),
        ...(ehexOrgPrivateKey !== undefined && { EHEX_ORG_PRIVATE_KEY: ehexOrgPrivateKey }),
        ...(ehexOrgCertificate !== undefined && { EHEX_ORG_CERTIFICATE: ehexOrgCertificate }),
        ...(ehexOrgCertificateIntermediate !== undefined && {
          EHEX_ORG_CERTIFICATE_INTERMEDIATE: ehexOrgCertificateIntermediate,
        }),
        ...(ehexOrgPrivateKeyPassword !== undefined && {
          EHEX_ORG_PRIVATE_KEY_PASSWORD: ehexOrgPrivateKeyPassword,
        }),
        ...(ehexTrustBundleBucket !== undefined && {
          EHEX_TRUST_BUNDLE_BUCKET_NAME: ehexTrustBundleBucket.bucketName,
        }),
        API_URL: apiURL,
        ...(sentryDsn ? { SENTRY_DSN: sentryDsn } : {}),
        MEDICAL_DOCUMENTS_BUCKET_NAME: medicalDocumentsBucket.bucketName,
        EHEX_RESPONSES_BUCKET_NAME: ehexResponsesBucket.bucketName,
        DEBUG_MODE_ENABLED: "false",
      },
      layers: [lambdaLayers.shared],
      memory: 1024,
      timeout: Duration.minutes(15),
      vpc,
    });

    this.grantSecretsReadAccess(documentRetrievalLambda, secrets, [
      "EHEX_ORG_CERTIFICATE",
      "EHEX_ORG_CERTIFICATE_INTERMEDIATE",
      "EHEX_ORG_PRIVATE_KEY",
      "EHEX_ORG_PRIVATE_KEY_PASSWORD",
    ]);

    ehexResponsesBucket.grantReadWrite(documentRetrievalLambda);
    medicalDocumentsBucket.grantReadWrite(documentRetrievalLambda);
    ehexTrustBundleBucket.grantRead(documentRetrievalLambda);
    // TODO ENG-1601 Remove this when we expose AuditLog as an async service
    auditLogsBucket.grantReadWrite(documentRetrievalLambda);

    return documentRetrievalLambda;
  }

  /**
   * Sets up the ALB with mTLS, WAF, and Global Accelerator for static IPs.
   *
   * Architecture: Global Accelerator (static IPs) → ALB (mTLS + WAF) → Lambda
   *
   * Note: Global Accelerator preserves client IP, enabling WAF's IP-based rules
   * (rate limiting, geo-fencing) to work correctly.
   */
  private setupAlbWithGlobalAccelerator({
    vpc,
    certificate,
    trustStoreBucket,
    trustStoreKey,
    environmentType,
  }: {
    vpc: ec2.IVpc;
    certificate: cert.ICertificate;
    trustStoreBucket: s3.IBucket;
    trustStoreKey: string;
    environmentType: EnvType;
  }): {
    alb: elbv2.ApplicationLoadBalancer;
    accelerator: globalaccelerator.Accelerator;
  } {
    const { waf } = settings();

    // Create security group for ALB
    const albSecurityGroup = new ec2.SecurityGroup(this, "EhexAlbSecurityGroup", {
      vpc,
      description: "Security group for Ehex ALB",
      allowAllOutbound: true,
    });

    // Allow HTTPS traffic from anywhere (Global Accelerator will route here)
    albSecurityGroup.addIngressRule(
      ec2.Peer.anyIpv4(),
      ec2.Port.tcp(443),
      "Allow HTTPS from Global Accelerator"
    );

    // Create S3 bucket for ALB access logs
    const accessLogsBucket = createBucket(this, {
      bucketName: `metriport-ehex-alb-access-logs-${environmentType}`,
    });

    // Create internet-facing ALB with access logging
    const alb = new elbv2.ApplicationLoadBalancer(this, "EhexAlb", {
      vpc,
      internetFacing: true,
      securityGroup: albSecurityGroup,
    });
    alb.logAccessLogs(accessLogsBucket, "ehex-alb-access-logs");

    // Create Trust Store for mTLS
    const trustStore = new elbv2.CfnTrustStore(this, "EhexTrustStore", {
      caCertificatesBundleS3Bucket: trustStoreBucket.bucketName,
      caCertificatesBundleS3Key: trustStoreKey,
      name: "ehex-trust-store",
    });

    // Add HTTPS listener
    const listener = alb.addListener("EhexAlbListener", {
      port: 443,
      protocol: elbv2.ApplicationProtocol.HTTPS,
      certificates: [certificate],
      defaultAction: elbv2.ListenerAction.fixedResponse(404, {
        contentType: "application/json",
        messageBody: JSON.stringify({ error: "Not Found" }),
      }),
    });

    // Configure mTLS on the listener using escape hatch
    const cfnListener = listener.node.defaultChild as elbv2.CfnListener;
    cfnListener.mutualAuthentication = {
      mode: "verify",
      trustStoreArn: trustStore.attrTrustStoreArn,
    };

    //-------------------------------------------
    // WAF Web ACL
    //-------------------------------------------
    const webAcl = new wafv2.CfnWebACL(this, "EhexWebAcl", {
      name: "ehex-web-acl",
      scope: "REGIONAL",
      defaultAction: { allow: {} },
      visibilityConfig: {
        cloudWatchMetricsEnabled: true,
        metricName: "ehex-web-acl",
        sampledRequestsEnabled: true,
      },
      rules: [
        {
          name: "AWS-AWSManagedRulesCommonRuleSet",
          priority: 1,
          overrideAction: { none: {} },
          statement: {
            managedRuleGroupStatement: {
              vendorName: "AWS",
              name: "AWSManagedRulesCommonRuleSet",
              excludedRules: [
                { name: "CrossSiteScripting_BODY" }, // Excluding generic XSS rule to allow XML payloads
                { name: "GenericRFI_BODY" }, // Excluding generic RFI body rule for things like webhook URLs - SSRF handled internally
                { name: "SizeRestrictions_BODY" }, // Excluding generic size body rule for lar - limits handled internally
                { name: "NoUserAgent_HEADER" }, // Excluding the block for the HTTP User-Agent header missing - TODO: alert customers before putting this block in
              ],
            },
          },
          visibilityConfig: {
            cloudWatchMetricsEnabled: true,
            metricName: "AWS-AWSManagedRulesCommonRuleSet",
            sampledRequestsEnabled: true,
          },
        },
        {
          name: "AWS-AWSManagedRulesKnownBadInputsRuleSet",
          priority: 2,
          overrideAction: { none: {} },
          statement: {
            managedRuleGroupStatement: {
              vendorName: "AWS",
              name: "AWSManagedRulesKnownBadInputsRuleSet",
              excludedRules: [
                { name: "JavaDeserializationRCE_BODY" }, // SOAP/XML payloads can trigger false positives for Java deserialization patterns
                { name: "JavaDeserializationRCE_HEADER" }, // SOAP headers can contain patterns that trigger this rule
              ],
            },
          },
          visibilityConfig: {
            cloudWatchMetricsEnabled: true,
            metricName: "AWS-AWSManagedRulesKnownBadInputsRuleSet",
            sampledRequestsEnabled: true,
          },
        },
        {
          name: "RateLimitRule",
          priority: 3,
          action: { block: {} },
          statement: {
            rateBasedStatement: {
              limit: waf.maxRequestPerIpOver5MinutesRateLimit,
              aggregateKeyType: "IP",
            },
          },
          visibilityConfig: {
            cloudWatchMetricsEnabled: true,
            metricName: "RateLimitRule",
            sampledRequestsEnabled: true,
          },
        },
      ],
    });

    // Associate WAF with ALB
    new wafv2.CfnWebACLAssociation(this, "EhexWebAclAssociation", {
      resourceArn: alb.loadBalancerArn,
      webAclArn: webAcl.attrArn,
    });

    // WAF CloudWatch Logging - log group name must start with "aws-waf-logs-"
    // The log group is created here but logging is NOT automatically enabled.
    // To enable/disable WAF logging, go to AWS WAF Console > Web ACLs > ehex-web-acl > Logging
    // and associate/disassociate this log group manually.
    new logs.LogGroup(this, "EhexWafLogGroup", {
      logGroupName: `aws-waf-logs-ehex-${environmentType}`,
      retention: logs.RetentionDays.ONE_YEAR,
      removalPolicy: RemovalPolicy.RETAIN,
    });

    //-------------------------------------------
    // Global Accelerator for static IPs
    //-------------------------------------------
    const accelerator = new globalaccelerator.Accelerator(this, "EhexAccelerator", {
      acceleratorName: "ehex-accelerator",
      enabled: true,
    });

    const acceleratorListener = accelerator.addListener("EhexAcceleratorListener", {
      portRanges: [{ fromPort: 443, toPort: 443 }],
      protocol: globalaccelerator.ConnectionProtocol.TCP,
    });

    acceleratorListener.addEndpointGroup("EhexEndpointGroup", {
      endpoints: [new ga_endpoints.ApplicationLoadBalancerEndpoint(alb)],
    });

    // Output the Global Accelerator static IPs
    new CfnOutput(this, "EhexGlobalAcceleratorIPs", {
      description: "Ehex Global Accelerator Static IPs",
      value: Fn.join(", ", accelerator.ipv4Addresses ?? []),
    });

    return { alb, accelerator };
  }

  /**
   * Sets up ALB routes for Lambda functions.
   * Creates target groups for each Lambda and adds path-based routing rules.
   */
  private setupAlbLambdaRoutes({
    alb,
    inboundPatientDiscoveryLambda,
    inboundDocumentQueryLambda,
    inboundDocumentRetrievalLambda,
    alertSnsAction,
  }: {
    alb: elbv2.ApplicationLoadBalancer;
    inboundPatientDiscoveryLambda: Lambda;
    inboundDocumentQueryLambda: Lambda;
    inboundDocumentRetrievalLambda: Lambda;
    alertSnsAction: SnsAction | undefined;
  }): void {
    const listener = alb.listeners[0];
    if (!listener) throw new Error("ALB listener not found");

    listener.addAction("HealthCheck", {
      priority: 1,
      conditions: [elbv2.ListenerCondition.pathPatterns(["/health"])],
      action: elbv2.ListenerAction.fixedResponse(200, {
        contentType: "application/json",
        messageBody: JSON.stringify({ status: "ok" }),
      }),
    });

    const pdTargetGroup = new elbv2.ApplicationTargetGroup(this, "EhexPdTargetGroup", {
      targetType: elbv2.TargetType.LAMBDA,
      targets: [new LambdaTarget(inboundPatientDiscoveryLambda)],
    });
    listener.addAction("PatientDiscovery", {
      priority: 10,
      conditions: [
        elbv2.ListenerCondition.pathPatterns(["/v1/patient-discovery"]),
        elbv2.ListenerCondition.httpRequestMethods(["POST"]),
      ],
      action: elbv2.ListenerAction.forward([pdTargetGroup]),
    });
    addDefaultMetricsToTargetGroup({
      targetGroup: pdTargetGroup,
      scope: this,
      id: "EhexPatientDiscovery",
      alertAction: alertSnsAction,
    });

    const dqTargetGroup = new elbv2.ApplicationTargetGroup(this, "EhexDqTargetGroup", {
      targetType: elbv2.TargetType.LAMBDA,
      targets: [new LambdaTarget(inboundDocumentQueryLambda)],
    });
    listener.addAction("DocumentQuery", {
      priority: 20,
      conditions: [
        elbv2.ListenerCondition.pathPatterns(["/v1/document-query"]),
        elbv2.ListenerCondition.httpRequestMethods(["POST"]),
      ],
      action: elbv2.ListenerAction.forward([dqTargetGroup]),
    });
    addDefaultMetricsToTargetGroup({
      targetGroup: dqTargetGroup,
      scope: this,
      id: "EhexDocumentQuery",
      alertAction: alertSnsAction,
    });

    const drTargetGroup = new elbv2.ApplicationTargetGroup(this, "EhexDrTargetGroup", {
      targetType: elbv2.TargetType.LAMBDA,
      targets: [new LambdaTarget(inboundDocumentRetrievalLambda)],
    });
    listener.addAction("DocumentRetrieval", {
      priority: 30,
      conditions: [
        elbv2.ListenerCondition.pathPatterns(["/v1/document-retrieve"]),
        elbv2.ListenerCondition.httpRequestMethods(["POST"]),
      ],
      action: elbv2.ListenerAction.forward([drTargetGroup]),
    });
    addDefaultMetricsToTargetGroup({
      targetGroup: drTargetGroup,
      scope: this,
      id: "EhexDocumentRetrieval",
      alertAction: alertSnsAction,
    });
  }
}

function setupSlackNotifSnsTopic(stack: Stack, config: EnvConfig): SnsAction | undefined {
  if (!config.slack) return undefined;
  const topicArn = config.ehexGateway?.snsTopicArn;
  if (!topicArn) throw new Error("Missing SNS topic ARN for Ehex stack");

  const slackNotifSnsTopic = sns.Topic.fromTopicArn(stack, "EhexSlackSnsTopic", topicArn);
  const alertAction = new SnsAction(slackNotifSnsTopic);
  return alertAction;
}
