import { Duration, NestedStack, NestedStackProps, Size } from "aws-cdk-lib";
import { SnsAction } from "aws-cdk-lib/aws-cloudwatch-actions";
import * as dynamodb from "aws-cdk-lib/aws-dynamodb";
import * as ec2 from "aws-cdk-lib/aws-ec2";
import * as iam from "aws-cdk-lib/aws-iam";
import * as lambda from "aws-cdk-lib/aws-lambda";
import { Function as Lambda } from "aws-cdk-lib/aws-lambda";
import { SqsEventSource } from "aws-cdk-lib/aws-lambda-event-sources";
import * as rds from "aws-cdk-lib/aws-rds";
import * as s3 from "aws-cdk-lib/aws-s3";
import * as secret from "aws-cdk-lib/aws-secretsmanager";
import { ISecret } from "aws-cdk-lib/aws-secretsmanager";
import { IQueue, Queue } from "aws-cdk-lib/aws-sqs";
import { Construct } from "constructs";
import { EnvConfig } from "../config/env-config";
import * as fhirConverterConnector from "./api-stack/fhir-converter-connector";
import { FHIRConverterConnector } from "./api-stack/fhir-converter-connector";
import { EnvType } from "./env-type";
import {
  getConsolidatedIngestionConnectorSettings,
  getConsolidatedSearchConnectorSettings,
} from "./lambdas-nested-stack-settings";
import { getHieSftpPasswordSecretName } from "./secrets-stack";
import { addBedrockPolicyToLambda } from "./shared/bedrock";
import { createLambda, MAXIMUM_LAMBDA_TIMEOUT } from "./shared/lambda";
import { LambdaLayers } from "./shared/lambda-layers";
import { createScheduledLambda } from "./shared/lambda-scheduled";
import { buildSecret, Secrets } from "./shared/secrets";
import { QueueAndLambdaSettings } from "./shared/settings";
import { createQueue } from "./shared/sqs";
import { isSandbox } from "./shared/util";

export const CDA_TO_VIS_TIMEOUT = Duration.minutes(15);

const pollingBuffer = Duration.seconds(30);

const reconversionKickoffWaitTime = Duration.seconds(5); // 12 patients/min
const reconversionKickoffLambdaTimeout = reconversionKickoffWaitTime.plus(Duration.seconds(25));

function getReconversionKickoffSettings(): QueueAndLambdaSettings {
  return {
    name: "ReconversionKickoff",
    entry: "reconversion-kickoff",
    lambda: {
      memory: 512,
      timeout: reconversionKickoffLambdaTimeout,
    },
    queue: {
      alarmMaxAgeOfOldestMessage: Duration.days(3),
      maxMessageCountAlarmThreshold: 50_000,
      maxReceiveCount: 3,
      visibilityTimeout: Duration.seconds(reconversionKickoffLambdaTimeout.toSeconds() * 2 + 1),
      createRetryLambda: false,
    },
    eventSource: {
      batchSize: 1,
      reportBatchItemFailures: true,
    },
    waitTime: reconversionKickoffWaitTime,
  };
}

export type OpenSearchConfigForLambdas = {
  endpoint: string;
  auth: { userName: string; secret: ISecret };
  consolidatedIndexName: string;
  documentIndexName: string;
};

interface LambdasNestedStackProps extends NestedStackProps {
  config: EnvConfig;
  vpc: ec2.IVpc;
  lambdaLayers: LambdaLayers;
  secrets: Secrets;
  dbCluster: rds.IDatabaseCluster;
  medicalDocumentsBucket: s3.Bucket;
  pharmacyBundleBucket: s3.Bucket | undefined;
  labBundleBucket: s3.Bucket | undefined;
  hl7ConversionBucket: s3.Bucket | undefined;
  sandboxSeedDataBucket: s3.IBucket | undefined;
  alarmAction?: SnsAction;
  featureFlagsTable: dynamodb.Table;
  bedrock: { modelId: string; region: string; anthropicVersion: string } | undefined;
  openSearch: OpenSearchConfigForLambdas;
  analyticsQueue?: IQueue | undefined;
  aiBriefBucket: s3.Bucket | undefined;
}

type GenericConsolidatedLambdaProps = {
  name: string;
  entry: string;
  lambdaLayers: LambdaLayers;
  vpc: ec2.IVpc;
  bundleBucket: s3.IBucket;
  pharmacyBundleBucket: s3.IBucket | undefined;
  labBundleBucket: s3.IBucket | undefined;
  conversionsBucket: s3.IBucket;
  hl7ConversionBucket: s3.IBucket | undefined;
  envType: EnvType;
  fhirServerUrl: string;
  sentryDsn: string | undefined;
  alarmAction: SnsAction | undefined;
  featureFlagsTable: dynamodb.Table;
  consolidatedIngestionQueue: IQueue;
  bedrock: { modelId: string; region: string; anthropicVersion: string } | undefined;
  analyticsQueue?: IQueue;
  aiBriefBucket: s3.Bucket | undefined;
};

type ConsolidatedLambdaProps = Omit<GenericConsolidatedLambdaProps, "name" | "entry" | "memory">;

export class LambdasNestedStack extends NestedStack {
  readonly cdaToVisualizationLambda: Lambda;
  readonly documentDownloaderLambda: Lambda;
  readonly fhirToCdaConverterLambda: Lambda;
  readonly outboundPatientDiscoveryLambda: Lambda | undefined;
  readonly outboundDocumentQueryLambda: Lambda | undefined;
  readonly outboundDocumentRetrievalLambda: Lambda | undefined;
  readonly fhirToBundleLambda: Lambda;
  readonly fhirToBundleCountLambda: Lambda;
  readonly consolidatedSearchLambda: Lambda;
  readonly consolidatedIngestionLambda: Lambda;
  readonly consolidatedIngestionQueue: IQueue;
  readonly fhirConverterConnector: FHIRConverterConnector;
  readonly acmCertificateMonitorLambda: Lambda;
  readonly hl7v2RosterUploadLambdas: Lambda[] | undefined;
  readonly hl7LahieSftpIngestionLambda: Lambda | undefined;
  readonly hl7AlohrSftpIngestionLambda: Lambda | undefined;
  readonly conversionResultNotifierLambda: Lambda;
  readonly reconversionKickoffLambda: Lambda;
  readonly reconversionKickoffQueue: Queue;

  constructor(scope: Construct, id: string, props: LambdasNestedStackProps) {
    super(scope, id, props);

    this.terminationProtection = true;

    this.cdaToVisualizationLambda = this.setupCdaToVisualization({
      lambdaLayers: props.lambdaLayers,
      vpc: props.vpc,
      envType: props.config.environmentType,
      medicalDocumentsBucket: props.medicalDocumentsBucket,
      sandboxSeedDataBucket: props.sandboxSeedDataBucket,
      sentryDsn: props.config.lambdasSentryDSN,
      alarmAction: props.alarmAction,
    });

    this.documentDownloaderLambda = this.setupDocumentDownloader({
      lambdaLayers: props.lambdaLayers,
      vpc: props.vpc,
      secrets: props.secrets,
      cwOrgCertificate: props.config.cwSecretNames.CW_ORG_CERTIFICATE,
      cwOrgPrivateKey: props.config.cwSecretNames.CW_ORG_PRIVATE_KEY,
      bucketName: props.medicalDocumentsBucket.bucketName,
      envType: props.config.environmentType,
      featureFlagsTable: props.featureFlagsTable,
      sentryDsn: props.config.lambdasSentryDSN,
    });

    this.fhirToCdaConverterLambda = this.setupFhirToCdaConverterLambda({
      lambdaLayers: props.lambdaLayers,
      vpc: props.vpc,
      medicalDocumentsBucket: props.medicalDocumentsBucket,
      envType: props.config.environmentType,
      systemRootOid: props.config.systemRootOID,
      sentryDsn: props.config.lambdasSentryDSN,
    });

    const cqConfig = props.config.carequality;
    if (cqConfig) {
      const cqRoDbCredsSecret = buildSecret(this, cqConfig.roUsername);

      this.outboundPatientDiscoveryLambda = this.setupOutboundPatientDiscovery({
        lambdaLayers: props.lambdaLayers,
        vpc: props.vpc,
        envType: props.config.environmentType,
        sentryDsn: props.config.lambdasSentryDSN,
        alarmAction: props.alarmAction,
        dbCluster: props.dbCluster,
        dbCredsSecret: cqRoDbCredsSecret,
        // TODO move this to a config
        maxPollingDuration: Duration.minutes(2),
      });

      this.outboundDocumentQueryLambda = this.setupOutboundDocumentQuery({
        lambdaLayers: props.lambdaLayers,
        vpc: props.vpc,
        envType: props.config.environmentType,
        sentryDsn: props.config.lambdasSentryDSN,
        alarmAction: props.alarmAction,
        dbCluster: props.dbCluster,
        dbCredsSecret: cqRoDbCredsSecret,
        // TODO move this to a config
        maxPollingDuration: Duration.minutes(15),
      });

      this.outboundDocumentRetrievalLambda = this.setupOutboundDocumentRetrieval({
        lambdaLayers: props.lambdaLayers,
        vpc: props.vpc,
        envType: props.config.environmentType,
        sentryDsn: props.config.lambdasSentryDSN,
        alarmAction: props.alarmAction,
        dbCluster: props.dbCluster,
        dbCredsSecret: cqRoDbCredsSecret,
        // TODO move this to a config
        maxPollingDuration: Duration.minutes(15),
      });
    }

    const resultNotifierConnector = this.setupConversionResultNotifier({
      vpc: props.vpc,
      config: props.config,
      alarmAction: props.alarmAction,
      lambdaLayers: props.lambdaLayers,
    });
    const conversionResultNotifierQueue = resultNotifierConnector.queue;
    this.conversionResultNotifierLambda = resultNotifierConnector.lambda;

    this.fhirConverterConnector = fhirConverterConnector.create({
      stack: this,
      vpc: props.vpc,
      lambdaLayers: props.lambdaLayers,
      envType: props.config.environmentType,
      config: props.config,
      featureFlagsTable: props.featureFlagsTable,
      medicalDocumentsBucket: props.medicalDocumentsBucket,
      apiNotifierQueue: conversionResultNotifierQueue,
      alarmSnsAction: props.alarmAction,
    });

    this.consolidatedIngestionQueue = this.setupConsolidatedIngestionQueue({
      envType: props.config.environmentType,
      alarmAction: props.alarmAction,
    });

    this.fhirToBundleLambda = this.setupFhirBundleLambda({
      lambdaLayers: props.lambdaLayers,
      vpc: props.vpc,
      fhirServerUrl: props.config.fhirServerUrl,
      bundleBucket: props.medicalDocumentsBucket,
      conversionsBucket: this.fhirConverterConnector.bucket,
      pharmacyBundleBucket: props.pharmacyBundleBucket,
      labBundleBucket: props.labBundleBucket,
      hl7ConversionBucket: props.hl7ConversionBucket,
      envType: props.config.environmentType,
      sentryDsn: props.config.lambdasSentryDSN,
      alarmAction: props.alarmAction,
      featureFlagsTable: props.featureFlagsTable,
      bedrock: props.config.bedrock,
      consolidatedIngestionQueue: this.consolidatedIngestionQueue,
      analyticsQueue: props.analyticsQueue,
      aiBriefBucket: props.aiBriefBucket,
    });
    this.fhirToBundleCountLambda = this.setupFhirBundleCountLambda({
      lambdaLayers: props.lambdaLayers,
      vpc: props.vpc,
      fhirServerUrl: props.config.fhirServerUrl,
      bundleBucket: props.medicalDocumentsBucket,
      conversionsBucket: this.fhirConverterConnector.bucket,
      pharmacyBundleBucket: props.pharmacyBundleBucket,
      labBundleBucket: props.labBundleBucket,
      hl7ConversionBucket: props.hl7ConversionBucket,
      envType: props.config.environmentType,
      sentryDsn: props.config.lambdasSentryDSN,
      alarmAction: props.alarmAction,
      featureFlagsTable: props.featureFlagsTable,
      bedrock: props.config.bedrock,
      consolidatedIngestionQueue: this.consolidatedIngestionQueue,
      aiBriefBucket: props.aiBriefBucket,
    });

    this.consolidatedSearchLambda = this.setupConsolidatedSearchLambda({
      lambdaLayers: props.lambdaLayers,
      vpc: props.vpc,
      envType: props.config.environmentType,
      fhirServerUrl: props.config.fhirServerUrl,
      bundleBucket: props.medicalDocumentsBucket,
      openSearchEndpoint: props.openSearch.endpoint,
      openSearchAuth: props.openSearch.auth,
      openSearchConsolidatedIndexName: props.openSearch.consolidatedIndexName,
      openSearchDocumentsIndexName: props.openSearch.documentIndexName,
      consolidatedDataIngestionInitialDate:
        props.config.openSearch.consolidatedDataIngestionInitialDate,
      featureFlagsTable: props.featureFlagsTable,
      sentryDsn: props.config.lambdasSentryDSN,
      alarmAction: props.alarmAction,
    });

    this.consolidatedIngestionLambda = this.setupConsolidatedIngestionLambda({
      lambdaLayers: props.lambdaLayers,
      vpc: props.vpc,
      envType: props.config.environmentType,
      bundleBucket: props.medicalDocumentsBucket,
      openSearchEndpoint: props.openSearch.endpoint,
      openSearchAuth: props.openSearch.auth,
      openSearchConsolidatedIndexName: props.openSearch.consolidatedIndexName,
      openSearchDocumentsIndexName: props.openSearch.documentIndexName,
      featureFlagsTable: props.featureFlagsTable,
      sentryDsn: props.config.lambdasSentryDSN,
      alarmAction: props.alarmAction,
    });

    this.acmCertificateMonitorLambda = this.setupAcmCertificateMonitor({
      lambdaLayers: props.lambdaLayers,
      vpc: props.vpc,
      envType: props.config.environmentType,
      sentryDsn: props.config.lambdasSentryDSN,
      alarmAction: props.alarmAction,
      notificationUrl: props.config.slack.SLACK_ALERT_URL,
      ...props.config.acmCertMonitor,
    });

    if (!isSandbox(props.config)) {
      const hl7v2RosterBucket = new s3.Bucket(this, "Hl7v2RosterBucket", {
        bucketName: props.config.hl7Notification.hl7v2RosterUploadLambda.bucketName,
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

      const lahieSftpIngestionBucket = new s3.Bucket(this, "lahieSftpIngestionBucket", {
        bucketName: props.config.hl7Notification.LahieSftpIngestionLambda.bucketName,
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

      const alohrSftpIngestionBucket = new s3.Bucket(this, "alohrSftpIngestionBucket", {
        bucketName: props.config.hl7Notification.AlohrSftpIngestionLambda.bucketName,
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

      this.hl7v2RosterUploadLambdas = this.setupRosterUploadLambdas({
        lambdaLayers: props.lambdaLayers,
        vpc: props.vpc,
        secrets: props.secrets,
        hl7v2RosterBucket,
        config: props.config,
        alarmAction: props.alarmAction,
        featureFlagsTable: props.featureFlagsTable,
      });

      this.hl7LahieSftpIngestionLambda = this.setupLahieSftpIngestionLambda({
        lambdaLayers: props.lambdaLayers,
        vpc: props.vpc,
        secrets: props.secrets,
        config: props.config,
        alarmAction: props.alarmAction,
        lahieSftpIngestionBucket,
      });

      this.hl7AlohrSftpIngestionLambda = this.setupAlohrSftpIngestionLambda({
        lambdaLayers: props.lambdaLayers,
        vpc: props.vpc,
        secrets: props.secrets,
        config: props.config,
        alarmAction: props.alarmAction,
        alohrSftpIngestionBucket,
      });
    }

    const { lambda: reconversionKickoffLambda, queue: reconversionKickoffQueue } =
      this.setupReconversionKickoff({
        lambdaLayers: props.lambdaLayers,
        sentryDsn: props.config.lambdasSentryDSN,
        vpc: props.vpc,
        envType: props.config.environmentType,
        alarmAction: props.alarmAction,
      });
    this.reconversionKickoffLambda = reconversionKickoffLambda;
    this.reconversionKickoffQueue = reconversionKickoffQueue;
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
      nameSuffix: "v2",
      runtime: lambda.Runtime.NODEJS_16_X,
      entry: "cda-to-visualization",
      envType,
      envVars: {
        CDA_TO_VIS_TIMEOUT_MS: CDA_TO_VIS_TIMEOUT.toMilliseconds().toString(),
        ...(sentryDsn ? { SENTRY_DSN: sentryDsn } : {}),
      },
      layers: [
        lambdaLayers.shared,
        lambdaLayers.chromium,
        // TODO when we remove this, make sure to remove the layer from the api-stack as well
        lambdaLayers.puppeteer,
        lambdaLayers.saxon,
      ],
      memory: 1024,
      ephemeralStorageSize: Size.gibibytes(1),
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
    featureFlagsTable: dynamodb.Table;
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
      featureFlagsTable,
      sentryDsn,
    } = ownProps;

    const documentDownloaderLambda = createLambda({
      stack: this,
      name: "DocumentDownloader",
      nameSuffix: "v2",
      runtime: lambda.Runtime.NODEJS_18_X,
      entry: "document-downloader",
      envType,
      envVars: {
        TEST_ENV: "TEST",
        CW_ORG_CERTIFICATE: cwOrgCertificate,
        CW_ORG_PRIVATE_KEY: cwOrgPrivateKey,
        ...(bucketName && {
          MEDICAL_DOCUMENTS_BUCKET_NAME: bucketName,
        }),
        FEATURE_FLAGS_TABLE_NAME: featureFlagsTable.tableName,
        ...(sentryDsn ? { SENTRY_DSN: sentryDsn } : {}),
      },
      layers: [lambdaLayers.shared],
      memory: 512,
      ephemeralStorageSize: Size.gibibytes(1),
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

    featureFlagsTable.grantReadData(documentDownloaderLambda);

    return documentDownloaderLambda;
  }

  private setupFhirToCdaConverterLambda(ownProps: {
    lambdaLayers: LambdaLayers;
    vpc: ec2.IVpc;
    medicalDocumentsBucket: s3.Bucket;
    envType: EnvType;
    systemRootOid: string;
    sentryDsn: string | undefined;
  }): Lambda {
    const { lambdaLayers, vpc, medicalDocumentsBucket, sentryDsn, envType, systemRootOid } =
      ownProps;

    const fhirToCdaConverterLambda = createLambda({
      stack: this,
      name: "FhirToCdaConverter",
      runtime: lambda.Runtime.NODEJS_18_X,
      entry: "fhir-to-cda-converter",
      envType,
      envVars: {
        MEDICAL_DOCUMENTS_BUCKET_NAME: medicalDocumentsBucket.bucketName,
        SYSTEM_ROOT_OID: systemRootOid,
        ...(sentryDsn ? { SENTRY_DSN: sentryDsn } : {}),
      },
      layers: [lambdaLayers.shared],
      memory: 1024, // TODO: 1603 - Monitor to see if more is required
      ephemeralStorageSize: Size.gibibytes(1),
      timeout: Duration.minutes(5),
      vpc,
    });

    medicalDocumentsBucket.grantReadWrite(fhirToCdaConverterLambda);
    return fhirToCdaConverterLambda;
  }

  private setupOutboundPatientDiscovery(ownProps: {
    lambdaLayers: LambdaLayers;
    vpc: ec2.IVpc;
    envType: EnvType;
    dbCredsSecret: secret.ISecret;
    dbCluster: rds.IDatabaseCluster;
    maxPollingDuration: Duration;
    sentryDsn: string | undefined;
    alarmAction: SnsAction | undefined;
  }): Lambda {
    const {
      lambdaLayers,
      dbCredsSecret,
      vpc,
      sentryDsn,
      envType,
      alarmAction,
      dbCluster,
      maxPollingDuration,
    } = ownProps;

    const outboundPatientDiscoveryLambda = createLambda({
      stack: this,
      name: "PollOutboundPatientDiscovery",
      entry: "ihe-outbound-patient-discovery",
      envType,
      envVars: {
        // API_URL set on the api-stack after the OSS API is created
        ...(sentryDsn ? { SENTRY_DSN: sentryDsn } : {}),
        DB_CREDS: dbCredsSecret.secretArn,
        MAX_POLLING_DURATION: this.normalizePollingDuration(maxPollingDuration),
      },
      layers: [lambdaLayers.shared],
      memory: 512,
      timeout: this.normalizeLambdaDuration(maxPollingDuration),
      vpc,
      alarmSnsAction: alarmAction,
    });

    dbCluster.connections.allowDefaultPortFrom(outboundPatientDiscoveryLambda);
    dbCredsSecret.grantRead(outboundPatientDiscoveryLambda);

    return outboundPatientDiscoveryLambda;
  }

  private setupOutboundDocumentQuery(ownProps: {
    lambdaLayers: LambdaLayers;
    vpc: ec2.IVpc;
    envType: EnvType;
    dbCredsSecret: secret.ISecret;
    dbCluster: rds.IDatabaseCluster;
    maxPollingDuration: Duration;
    sentryDsn: string | undefined;
    alarmAction: SnsAction | undefined;
  }): Lambda {
    const {
      lambdaLayers,
      dbCredsSecret,
      vpc,
      sentryDsn,
      envType,
      alarmAction,
      dbCluster,
      maxPollingDuration,
    } = ownProps;

    const outboundDocumentQueryLambda = createLambda({
      stack: this,
      name: "PollOutboundDocumentQuery",
      entry: "ihe-outbound-document-query",
      envType,
      envVars: {
        // API_URL set on the api-stack after the OSS API is created
        ...(sentryDsn ? { SENTRY_DSN: sentryDsn } : {}),
        DB_CREDS: dbCredsSecret.secretArn,
        MAX_POLLING_DURATION: this.normalizePollingDuration(maxPollingDuration),
      },
      layers: [lambdaLayers.shared],
      memory: 512,
      timeout: this.normalizeLambdaDuration(maxPollingDuration),
      vpc,
      alarmSnsAction: alarmAction,
    });

    dbCluster.connections.allowDefaultPortFrom(outboundDocumentQueryLambda);
    dbCredsSecret.grantRead(outboundDocumentQueryLambda);

    return outboundDocumentQueryLambda;
  }

  private setupOutboundDocumentRetrieval(ownProps: {
    lambdaLayers: LambdaLayers;
    vpc: ec2.IVpc;
    envType: EnvType;
    dbCredsSecret: secret.ISecret;
    dbCluster: rds.IDatabaseCluster;
    maxPollingDuration: Duration;
    sentryDsn: string | undefined;
    alarmAction: SnsAction | undefined;
  }): Lambda {
    const {
      lambdaLayers,
      dbCredsSecret,
      vpc,
      sentryDsn,
      envType,
      alarmAction,
      dbCluster,
      maxPollingDuration,
    } = ownProps;

    const outboundDocumentRetrievalLambda = createLambda({
      stack: this,
      name: "PollOutboundDocumentRetrieval",
      entry: "ihe-outbound-document-retrieval",
      envType,
      envVars: {
        // API_URL set on the api-stack after the OSS API is created
        ...(sentryDsn ? { SENTRY_DSN: sentryDsn } : {}),
        DB_CREDS: dbCredsSecret.secretArn,
        MAX_POLLING_DURATION: this.normalizePollingDuration(maxPollingDuration),
      },
      layers: [lambdaLayers.shared],
      memory: 512,
      timeout: this.normalizeLambdaDuration(maxPollingDuration),
      vpc,
      alarmSnsAction: alarmAction,
    });

    dbCluster.connections.allowDefaultPortFrom(outboundDocumentRetrievalLambda);
    dbCredsSecret.grantRead(outboundDocumentRetrievalLambda);

    return outboundDocumentRetrievalLambda;
  }

  private setupConversionResultNotifier({
    vpc,
    alarmAction,
    config,
    lambdaLayers,
  }: {
    vpc: ec2.IVpc;
    alarmAction: SnsAction | undefined;
    config: EnvConfig;
    lambdaLayers: LambdaLayers;
  }): { queue: Queue; lambda: Lambda } {
    const name = "ConversionResultNotifier";
    const { environmentType: envType, sentryDSN } = config;

    const lambdaTimeout = Duration.minutes(5);
    const settings = {
      queue: {
        maxReceiveCount: 1,
        alarmMaxAgeOfOldestMessage: Duration.minutes(5),
        maxMessageCountAlarmThreshold: 100_000,
        visibilityTimeout: Duration.seconds(lambdaTimeout.toSeconds() * 2 + 1),
        receiveMessageWaitTime: Duration.seconds(20),
      },
      lambda: {
        entry: "conversion-result-notifier",
        memory: 256,
        timeout: lambdaTimeout,
      },
      eventSource: {
        batchSize: 500,
        maxBatchingWindow: Duration.seconds(20),
        maxConcurrency: 2,
        // Partial batch response: https://docs.aws.amazon.com/prescriptive-guidance/latest/lambda-event-filtering-partial-batch-responses-for-sqs/welcome.html
        reportBatchItemFailures: true,
      },
    };

    const conversionResultQueue = createQueue({
      stack: this,
      name,
      createRetryLambda: false,
      envType,
      alarmSnsAction: alarmAction,
      ...settings.queue,
    });

    const conversionResultLambda = createLambda({
      stack: this,
      name,
      envType,
      envVars: {
        // API_URL set on the api-stack after the OSS API is created
        ...(sentryDSN ? { SENTRY_DSN: sentryDSN } : {}),
      },
      layers: [lambdaLayers.shared],
      vpc,
      alarmSnsAction: alarmAction,
      ...settings.lambda,
    });

    conversionResultLambda.addEventSource(
      new SqsEventSource(conversionResultQueue, settings.eventSource)
    );
    return { queue: conversionResultQueue, lambda: conversionResultLambda };
  }

  /** AKA, get consolidated lambda */
  private setupFhirBundleLambda(params: ConsolidatedLambdaProps): Lambda {
    return this.setupGenericConsolidatedLambda({
      ...params,
      name: "FhirToBundle",
      entry: "fhir-to-bundle",
    });
  }
  private setupFhirBundleCountLambda(params: ConsolidatedLambdaProps): Lambda {
    return this.setupGenericConsolidatedLambda({
      ...params,
      name: "FhirToBundleCount",
      entry: "fhir-to-bundle-count",
    });
  }

  private setupGenericConsolidatedLambda({
    name,
    entry,
    lambdaLayers,
    vpc,
    fhirServerUrl,
    bundleBucket,
    conversionsBucket,
    pharmacyBundleBucket,
    aiBriefBucket,
    hl7ConversionBucket,
    labBundleBucket,
    sentryDsn,
    envType,
    alarmAction,
    featureFlagsTable,
    bedrock,
    consolidatedIngestionQueue,
    analyticsQueue,
  }: GenericConsolidatedLambdaProps): Lambda {
    const lambdaTimeout = MAXIMUM_LAMBDA_TIMEOUT.minus(Duration.seconds(5));

    const theLambda = createLambda({
      stack: this,
      name,
      runtime: lambda.Runtime.NODEJS_20_X,
      entry,
      envType,
      envVars: {
        // API_URL set on the api-stack after the OSS API is created
        FHIR_SERVER_URL: fhirServerUrl,
        BUCKET_NAME: bundleBucket.bucketName,
        MEDICAL_DOCUMENTS_BUCKET_NAME: bundleBucket.bucketName,
        CONVERSION_RESULT_BUCKET_NAME: conversionsBucket.bucketName,
        ...(pharmacyBundleBucket && {
          PHARMACY_CONVERSION_BUCKET_NAME: pharmacyBundleBucket.bucketName,
        }),
        ...(labBundleBucket && {
          LAB_CONVERSION_BUCKET_NAME: labBundleBucket.bucketName,
        }),
        ...(hl7ConversionBucket && {
          HL7_CONVERSION_BUCKET_NAME: hl7ConversionBucket.bucketName,
        }),
        FEATURE_FLAGS_TABLE_NAME: featureFlagsTable.tableName,
        ...(bedrock && {
          // API_URL set on the api-stack after the OSS API is created
          BEDROCK_REGION: bedrock?.region,
          BEDROCK_VERSION: bedrock?.anthropicVersion,
          AI_BRIEF_MODEL_ID: bedrock?.modelId,
        }),
        CONSOLIDATED_INGESTION_QUEUE_URL: consolidatedIngestionQueue.queueUrl,
        ...(sentryDsn ? { SENTRY_DSN: sentryDsn } : {}),
        ...(analyticsQueue && {
          FHIR_TO_CSV_INCREMENTAL_QUEUE_URL: analyticsQueue.queueUrl,
        }),
        ...(aiBriefBucket && {
          AI_BRIEF_BUCKET_NAME: aiBriefBucket.bucketName,
        }),
      },
      layers: [lambdaLayers.shared, lambdaLayers.langchain],
      memory: 6144,
      ephemeralStorageSize: Size.gibibytes(2),
      timeout: lambdaTimeout,
      isEnableInsights: true,
      vpc,
      alarmSnsAction: alarmAction,
    });

    bundleBucket.grantReadWrite(theLambda);
    conversionsBucket.grantRead(theLambda);
    pharmacyBundleBucket?.grantRead(theLambda);
    labBundleBucket?.grantRead(theLambda);
    hl7ConversionBucket?.grantRead(theLambda);
    aiBriefBucket?.grantReadWrite(theLambda);

    featureFlagsTable.grantReadData(theLambda);

    consolidatedIngestionQueue.grantSendMessages(theLambda);
    analyticsQueue?.grantSendMessages(theLambda);

    // Always add the bedrock policy to the lambda, regardless of whether bedrock is defined or not
    addBedrockPolicyToLambda(theLambda);

    return theLambda;
  }

  private setupConsolidatedSearchLambda(ownProps: {
    lambdaLayers: LambdaLayers;
    vpc: ec2.IVpc;
    envType: EnvType;
    fhirServerUrl: string;
    bundleBucket: s3.IBucket;
    featureFlagsTable: dynamodb.Table;
    openSearchEndpoint: string;
    openSearchAuth: { userName: string; secret: ISecret };
    openSearchDocumentsIndexName: string;
    openSearchConsolidatedIndexName: string;
    consolidatedDataIngestionInitialDate: string;
    sentryDsn: string | undefined;
    alarmAction: SnsAction | undefined;
  }): Lambda {
    const { name, lambda: lambdaSettings } = getConsolidatedSearchConnectorSettings();
    const lambdaEntry = "consolidated-search";
    const {
      lambdaLayers,
      vpc,
      envType,
      fhirServerUrl,
      bundleBucket,
      featureFlagsTable,
      openSearchEndpoint,
      openSearchAuth,
      openSearchConsolidatedIndexName,
      openSearchDocumentsIndexName,
      consolidatedDataIngestionInitialDate,
      sentryDsn,
      alarmAction,
    } = ownProps;

    const theLambda = createLambda({
      stack: this,
      name,
      runtime: lambdaSettings.runtime,
      entry: lambdaEntry,
      envType,
      envVars: {
        // API_URL set on the api-stack after the OSS API is created
        FHIR_SERVER_URL: fhirServerUrl,
        MEDICAL_DOCUMENTS_BUCKET_NAME: bundleBucket.bucketName,
        FEATURE_FLAGS_TABLE_NAME: featureFlagsTable.tableName,
        SEARCH_ENDPOINT: openSearchEndpoint,
        SEARCH_USERNAME: openSearchAuth.userName,
        SEARCH_PASSWORD_SECRET_ARN: openSearchAuth.secret.secretArn,
        SEARCH_INDEX: openSearchDocumentsIndexName,
        CONSOLIDATED_SEARCH_INDEX: openSearchConsolidatedIndexName,
        CONSOLIDATED_INGESTION_INITIAL_DATE: consolidatedDataIngestionInitialDate,
        ...(sentryDsn ? { SENTRY_DSN: sentryDsn } : {}),
      },
      layers: [lambdaLayers.shared, lambdaLayers.langchain],
      memory: lambdaSettings.memory,
      timeout: lambdaSettings.timeout,
      isEnableInsights: true,
      vpc,
      alarmSnsAction: alarmAction,
    });

    bundleBucket.grantReadWrite(theLambda);
    openSearchAuth.secret.grantRead(theLambda);
    featureFlagsTable.grantReadData(theLambda);

    return theLambda;
  }

  private setupConsolidatedIngestionQueue(ownProps: {
    envType: EnvType;
    alarmAction: SnsAction | undefined;
  }): IQueue {
    const { envType, alarmAction } = ownProps;
    const settings = getConsolidatedIngestionConnectorSettings();
    const name = settings.name;

    const theQueue = createQueue({
      stack: this,
      name,
      envType,
      alarmSnsAction: alarmAction,
      ...settings.queue,
    });

    return theQueue;
  }

  private setupConsolidatedIngestionLambda(ownProps: {
    lambdaLayers: LambdaLayers;
    vpc: ec2.IVpc;
    envType: EnvType;
    bundleBucket: s3.IBucket;
    featureFlagsTable: dynamodb.Table;
    openSearchEndpoint: string;
    openSearchAuth: { userName: string; secret: ISecret };
    openSearchDocumentsIndexName: string;
    openSearchConsolidatedIndexName: string;
    sentryDsn: string | undefined;
    alarmAction: SnsAction | undefined;
  }): Lambda {
    const settings = getConsolidatedIngestionConnectorSettings();
    const name = settings.name;
    const lambdaEntry = "consolidated-ingestion";
    const {
      lambdaLayers,
      vpc,
      envType,
      bundleBucket,
      featureFlagsTable,
      openSearchEndpoint,
      openSearchAuth,
      openSearchConsolidatedIndexName,
      openSearchDocumentsIndexName,
      sentryDsn,
      alarmAction,
    } = ownProps;

    const theLambda = createLambda({
      stack: this,
      name,
      entry: lambdaEntry,
      envType,
      envVars: {
        // API_URL set on the api-stack after the OSS API is created
        FEATURE_FLAGS_TABLE_NAME: featureFlagsTable.tableName,
        MEDICAL_DOCUMENTS_BUCKET_NAME: bundleBucket.bucketName,
        SEARCH_ENDPOINT: openSearchEndpoint,
        SEARCH_USERNAME: openSearchAuth.userName,
        SEARCH_PASSWORD_SECRET_ARN: openSearchAuth.secret.secretArn,
        SEARCH_INDEX: openSearchDocumentsIndexName,
        CONSOLIDATED_SEARCH_INDEX: openSearchConsolidatedIndexName,
        ...(sentryDsn ? { SENTRY_DSN: sentryDsn } : {}),
      },
      layers: [lambdaLayers.shared, lambdaLayers.langchain],
      isEnableInsights: true,
      vpc,
      alarmSnsAction: alarmAction,
      ...settings.lambda,
    });

    theLambda.addEventSource(
      new SqsEventSource(this.consolidatedIngestionQueue, settings.eventSource)
    );

    bundleBucket.grantReadWrite(theLambda);
    openSearchAuth.secret.grantRead(theLambda);
    featureFlagsTable.grantReadData(theLambda);

    return theLambda;
  }

  /**
   * Max polling duration should not exceed the maximum lambda execution time minus
   * 30 seconds as buffer for the response to make it to the API.
   */
  private normalizePollingDuration(duration: Duration): string {
    return Math.min(
      duration.toMilliseconds(),
      MAXIMUM_LAMBDA_TIMEOUT.minus(pollingBuffer).toMilliseconds()
    ).toString();
  }

  /**
   * Max lambda duration/timeout should not be lower than polling duration + 30 seconds
   * as buffer for the response to make it to the API.
   */
  private normalizeLambdaDuration(duration: Duration): Duration {
    return Duration.millis(
      Math.min(
        duration.plus(pollingBuffer).toMilliseconds(),
        MAXIMUM_LAMBDA_TIMEOUT.toMilliseconds()
      )
    );
  }

  private setupAcmCertificateMonitor(ownProps: {
    lambdaLayers: LambdaLayers;
    vpc: ec2.IVpc;
    envType: EnvType;
    sentryDsn: string | undefined;
    alarmAction: SnsAction | undefined;
    scheduleExpressions: string | string[];
    notificationUrl: string;
    heartbeatUrl: string;
  }): Lambda {
    const {
      lambdaLayers,
      vpc,
      sentryDsn,
      envType,
      scheduleExpressions,
      heartbeatUrl,
      notificationUrl,
    } = ownProps;

    const acmCertificateMonitorLambda = createScheduledLambda({
      stack: this,
      layers: [lambdaLayers.shared],
      name: "ScheduledAcmCertificateMonitor",
      entry: "acm-cert-monitor",
      vpc,
      memory: 256,
      timeout: Duration.minutes(2),
      scheduleExpression: scheduleExpressions,
      envType,
      envVars: {
        ...(sentryDsn ? { SENTRY_DSN: sentryDsn } : {}),
        SLACK_NOTIFICATION_URL: notificationUrl,
        HEARTBEAT_URL: heartbeatUrl,
      },
    });

    acmCertificateMonitorLambda.addToRolePolicy(
      new iam.PolicyStatement({
        actions: ["acm:ListCertificates"],
        resources: ["*"],
      })
    );

    return acmCertificateMonitorLambda;
  }

  private setupAlohrSftpIngestionLambda(ownProps: {
    lambdaLayers: LambdaLayers;
    vpc: ec2.IVpc;
    secrets: Secrets;
    config: EnvConfig;
    alohrSftpIngestionBucket: s3.IBucket;
    alarmAction: SnsAction | undefined;
  }): Lambda {
    const envType = ownProps.config.environmentType;
    const alohrProps = ownProps.config.hl7Notification?.AlohrSftpIngestionLambda;
    const sftpPasswordSecret = ownProps.secrets["ALOHR_INGESTION_PASSWORD"];
    const queue = ownProps.config.hl7Notification?.notificationWebhookSenderQueue;
    const alohr = ownProps.config.hl7Notification?.hieConfigs["Alohr"];

    if (!alohrProps) {
      throw new Error("AlohrSftpIngestionLambda is undefined in config.");
    }
    if (!ownProps.config.hl7Notification) {
      throw new Error("HL7Notification is undefined in config.");
    }
    if (!queue) {
      throw new Error("HL7NotificationWebhookSenderQueue is undefined in config.");
    }
    if (!sftpPasswordSecret) {
      throw new Error("ALOHR_INGESTION_PASSWORD is not defined in config.");
    }
    if (!alohr) {
      throw new Error("Alohr is undefined in config.");
    }

    const sftpConfig = alohrProps.sftpConfig;
    const lambdaTimeout = Duration.minutes(5);
    const lambdaMemorySize = 1024;
    const hl7Base64ScramblerSeed = ownProps.secrets["HL7_BASE64_SCRAMBLER_SEED"];

    if (!hl7Base64ScramblerSeed) {
      throw new Error("HL7_BASE64_SCRAMBLER_SEED is not defined in config.");
    }

    const lambda = createScheduledLambda({
      layers: [ownProps.lambdaLayers.shared],
      vpc: ownProps.vpc,
      timeout: lambdaTimeout,
      memory: lambdaMemorySize,
      scheduleExpression: "0/15 * * * ? *",
      envType,
      entry: "hl7-alohr-sftp-ingestion",
      envVars: {
        ALOHR_INGESTION_SFTP_CONFIG: JSON.stringify(sftpConfig),
        ALOHR_INGESTION_REMOTE_PATH: sftpConfig.remotePath,
        ALOHR_INGESTION_PASSWORD_ARN: sftpPasswordSecret.secretArn,
        ALOHR_INGESTION_BUCKET_NAME: ownProps.alohrSftpIngestionBucket.bucketName,
        HL7_BASE64_SCRAMBLER_SEED_ARN: hl7Base64ScramblerSeed.secretArn,
        HL7_NOTIFICATION_QUEUE_URL: queue.url,
        ALOHR_INGESTION_TIMEZONE: alohr.timezone,
      },
      stack: this,
      name: "Hl7SftpIngestionAlohr",
      alarmSnsAction: ownProps.alarmAction,
    });

    sftpPasswordSecret.grantRead(lambda);

    ownProps.alohrSftpIngestionBucket.grantReadWrite(lambda);
    hl7Base64ScramblerSeed.grantRead(lambda);
    const webhookSenderQueue = Queue.fromQueueArn(this, "Hl7WebhookSenderQueueAlohr", queue.arn);
    webhookSenderQueue.grantSendMessages(lambda);
    return lambda;
  }

  private setupLahieSftpIngestionLambda(ownProps: {
    lambdaLayers: LambdaLayers;
    vpc: ec2.IVpc;
    secrets: Secrets;
    config: EnvConfig;
    lahieSftpIngestionBucket: s3.IBucket;
    alarmAction: SnsAction | undefined;
  }): Lambda {
    const envType = ownProps.config.environmentType;
    const props = ownProps.config.hl7Notification?.LahieSftpIngestionLambda;
    if (!props) {
      throw new Error("LahieSftpIngestionLambda is undefined in config.");
    }

    const sftpPasswordSecret = ownProps.secrets["LAHIE_INGESTION_PASSWORD"];
    const privateKeySecret = ownProps.secrets["LAHIE_INGESTION_PRIVATE_KEY"];
    const passphraseSecret = ownProps.secrets["LAHIE_INGESTION_PASSPHRASE"];
    if (!ownProps.config.hl7Notification) {
      throw new Error("HL7Notification is undefined in config.");
    }
    const queue = ownProps.config.hl7Notification.notificationWebhookSenderQueue;

    if (!queue) {
      throw new Error("HL7NotificationWebhookSenderQueue is undefined in config.");
    }

    if (!sftpPasswordSecret) {
      throw new Error("LAHIE_INGESTION_PASSWORD is not defined in config.");
    }

    if (!privateKeySecret) {
      throw new Error("LAHIE_INGESTION_PRIVATE_KEY is not defined in config.");
    }

    if (!passphraseSecret) {
      throw new Error("LAHIE_INGESTION_PASSPHRASE is not defined in config.");
    }

    const sftpConfig = props.sftpConfig;
    const lambdaTimeout = Duration.minutes(5);
    const lambdaMemorySize = 1024;
    const hl7Base64ScramblerSeed = ownProps.secrets["HL7_BASE64_SCRAMBLER_SEED"];

    if (!hl7Base64ScramblerSeed) {
      throw new Error("HL7_BASE64_SCRAMBLER_SEED is not defined in config.");
    }

    const lambda = createScheduledLambda({
      layers: [ownProps.lambdaLayers.shared],
      vpc: ownProps.vpc,
      timeout: lambdaTimeout,
      memory: lambdaMemorySize,
      scheduleExpression: "0 15 * * ? *",
      envType,
      entry: "hl7-lahie-sftp-ingestion",
      envVars: {
        LAHIE_INGESTION_PORT: sftpConfig.port.toString(),
        LAHIE_INGESTION_HOST: sftpConfig.host,
        LAHIE_INGESTION_REMOTE_PATH: sftpConfig.remotePath,
        LAHIE_INGESTION_USERNAME: sftpConfig.username,
        LAHIE_INGESTION_PASSWORD_ARN: sftpPasswordSecret.secretArn,
        LAHIE_INGESTION_BUCKET_NAME: ownProps.lahieSftpIngestionBucket.bucketName,
        LAHIE_INGESTION_PRIVATE_KEY_ARN: privateKeySecret.secretArn,
        LAHIE_INGESTION_PRIVATE_KEY_PASSPHRASE_ARN: passphraseSecret.secretArn,
        HL7_BASE64_SCRAMBLER_SEED_ARN: hl7Base64ScramblerSeed.secretArn,
        HL7_NOTIFICATION_QUEUE_URL: queue.url,
      },
      stack: this,
      name: "Hl7SftpIngestionLahie",
      alarmSnsAction: ownProps.alarmAction,
    });

    sftpPasswordSecret.grantRead(lambda);
    privateKeySecret.grantRead(lambda);
    passphraseSecret.grantRead(lambda);
    ownProps.lahieSftpIngestionBucket.grantReadWrite(lambda);
    hl7Base64ScramblerSeed.grantRead(lambda);
    const webhookSenderQueue = Queue.fromQueueArn(this, "Hl7WebhookSenderQueue", queue.arn);
    webhookSenderQueue.grantSendMessages(lambda);
    return lambda;
  }

  private setupRosterUploadLambdas(ownProps: {
    lambdaLayers: LambdaLayers;
    vpc: ec2.IVpc;
    secrets: Secrets;
    hl7v2RosterBucket: s3.IBucket;
    config: EnvConfig;
    alarmAction: SnsAction | undefined;
    featureFlagsTable: dynamodb.Table;
  }): Lambda[] {
    const {
      lambdaLayers,
      vpc,
      secrets,
      hl7v2RosterBucket,
      config,
      alarmAction,
      featureFlagsTable,
    } = ownProps;
    const sentryDsn = config.lambdasSentryDSN;
    const envType = config.environmentType;

    const rosterUploadLambdas: Lambda[] = [];
    if (config.hl7Notification?.hieConfigs) {
      const hl7ScramblerSeedSecret = secrets["HL7_BASE64_SCRAMBLER_SEED"];
      if (!hl7ScramblerSeedSecret) {
        throw new Error(`HL7_BASE64_SCRAMBLER_SEED is not defined in config`);
      }
      const hieConfigs = config.hl7Notification.hieConfigs;
      const posthogSecretName = config.analyticsSecretNames.POST_HOG_API_KEY_SECRET;
      const posthogSecret = secrets["POST_HOG_API_KEY_SECRET"];

      if (!posthogSecret) {
        throw new Error("No posthog secret found.");
      }

      Object.entries(hieConfigs).forEach(([hieName, hieConfig]) => {
        const passwordSecretName = getHieSftpPasswordSecretName(hieName);
        const passwordSecret = secrets[passwordSecretName];
        if (!passwordSecret) {
          throw new Error(`${passwordSecretName} is not defined in config`);
        }

        const lambda = createScheduledLambda({
          stack: this,
          name: `Hl7v2RosterUpload-${hieName}`,
          entry: "hl7v2-roster",
          scheduleExpression: hieConfig.cron,
          eventInput: hieConfig,
          envType,
          envVars: {
            HL7V2_ROSTER_BUCKET_NAME: hl7v2RosterBucket.bucketName,
            API_URL: config.loadBalancerDnsName,
            HL7_BASE64_SCRAMBLER_SEED_ARN: hl7ScramblerSeedSecret.secretArn,
            ROSTER_UPLOAD_SFTP_PASSWORD_NAME: passwordSecretName,
            ...(sentryDsn ? { SENTRY_DSN: sentryDsn } : {}),
            POST_HOG_API_KEY_SECRET: posthogSecretName,
            FEATURE_FLAGS_TABLE_NAME: featureFlagsTable.tableName,
          },
          timeout: Duration.minutes(10),
          layers: [lambdaLayers.shared],
          memory: 4096,
          vpc,
          alarmSnsAction: alarmAction,
        });
        posthogSecret.grantRead(lambda);
        passwordSecret.grantRead(lambda);
        hl7ScramblerSeedSecret.grantRead(lambda);
        hl7v2RosterBucket.grantReadWrite(lambda);
        featureFlagsTable.grantReadData(lambda);

        rosterUploadLambdas.push(lambda);
      });
    }

    return rosterUploadLambdas;
  }

  private setupReconversionKickoff(ownProps: {
    lambdaLayers: LambdaLayers;
    sentryDsn: string | undefined;
    vpc: ec2.IVpc;
    envType: EnvType;
    alarmAction: SnsAction | undefined;
  }): { lambda: Lambda; queue: Queue } {
    const { lambdaLayers, vpc, envType, sentryDsn, alarmAction } = ownProps;
    const settings = getReconversionKickoffSettings();

    const queue = createQueue({
      ...settings.queue,
      stack: this,
      name: settings.name,
      fifo: true,
      createDLQ: true,
      lambdaLayers: [lambdaLayers.shared],
      envType,
      alarmSnsAction: alarmAction,
    });

    const lambda = createLambda({
      ...settings.lambda,
      stack: this,
      name: settings.name,
      entry: settings.entry,
      envType,
      envVars: {
        // API_URL set on the api-stack after the OSS API is created
        WAIT_TIME_IN_MILLIS: reconversionKickoffWaitTime.toMilliseconds().toString(),
        ...(sentryDsn ? { SENTRY_DSN: sentryDsn } : {}),
      },
      layers: [lambdaLayers.shared],
      vpc,
      alarmSnsAction: alarmAction,
    });

    lambda.addEventSource(new SqsEventSource(queue, settings.eventSource));

    return { lambda, queue };
  }
}
