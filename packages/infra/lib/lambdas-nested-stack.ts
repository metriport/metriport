import { Duration, NestedStack, NestedStackProps } from "aws-cdk-lib";
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
import { addBedrockPolicyToLambda } from "./shared/bedrock";
import { createLambda, MAXIMUM_LAMBDA_TIMEOUT } from "./shared/lambda";
import { LambdaLayers } from "./shared/lambda-layers";
import { createScheduledLambda } from "./shared/lambda-scheduled";
import { Secrets } from "./shared/secrets";
import { createQueue } from "./shared/sqs";
import { isSandbox } from "./shared/util";

export const CDA_TO_VIS_TIMEOUT = Duration.minutes(15);

const pollingBuffer = Duration.seconds(30);

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
  roDbSecrets: secret.ISecret[];
  medicalDocumentsBucket: s3.Bucket;
  sandboxSeedDataBucket: s3.IBucket | undefined;
  alarmAction?: SnsAction;
  featureFlagsTable: dynamodb.Table;
  bedrock: { modelId: string; region: string; anthropicVersion: string } | undefined;
  openSearch: OpenSearchConfigForLambdas;
}

type GenericConsolidatedLambdaProps = {
  name: string;
  entry: string;
  lambdaLayers: LambdaLayers;
  vpc: ec2.IVpc;
  bundleBucket: s3.IBucket;
  conversionsBucket: s3.IBucket;
  envType: EnvType;
  fhirServerUrl: string;
  sentryDsn: string | undefined;
  alarmAction: SnsAction | undefined;
  featureFlagsTable: dynamodb.Table;
  consolidatedIngestionQueue: IQueue;
  bedrock: { modelId: string; region: string; anthropicVersion: string } | undefined;
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
  readonly conversionResultNotifierLambda: Lambda;

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
      const cqRoDbCredsSecret = props.roDbSecrets.find(
        secret => secret.secretName === `DBCreds-${cqConfig.roUsername}`
      );
      if (!cqRoDbCredsSecret) {
        throw new Error(`RO CQ DB Creds secret not found`);
      }

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
      envType: props.config.environmentType,
      sentryDsn: props.config.lambdasSentryDSN,
      alarmAction: props.alarmAction,
      featureFlagsTable: props.featureFlagsTable,
      bedrock: props.config.bedrock,
      consolidatedIngestionQueue: this.consolidatedIngestionQueue,
    });
    this.fhirToBundleCountLambda = this.setupFhirBundleCountLambda({
      lambdaLayers: props.lambdaLayers,
      vpc: props.vpc,
      fhirServerUrl: props.config.fhirServerUrl,
      bundleBucket: props.medicalDocumentsBucket,
      conversionsBucket: this.fhirConverterConnector.bucket,
      envType: props.config.environmentType,
      sentryDsn: props.config.lambdasSentryDSN,
      alarmAction: props.alarmAction,
      featureFlagsTable: props.featureFlagsTable,
      bedrock: props.config.bedrock,
      consolidatedIngestionQueue: this.consolidatedIngestionQueue,
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

      this.hl7v2RosterUploadLambdas = this.setupRosterUploadLambdas({
        lambdaLayers: props.lambdaLayers,
        vpc: props.vpc,
        secrets: props.secrets,
        hl7v2RosterBucket,
        config: props.config,
        alarmAction: props.alarmAction,
      });
    }
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
    sentryDsn,
    envType,
    alarmAction,
    featureFlagsTable,
    bedrock,
    consolidatedIngestionQueue,
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
        FEATURE_FLAGS_TABLE_NAME: featureFlagsTable.tableName,
        ...(bedrock && {
          // API_URL set on the api-stack after the OSS API is created
          BEDROCK_REGION: bedrock?.region,
          BEDROCK_VERSION: bedrock?.anthropicVersion,
          AI_BRIEF_MODEL_ID: bedrock?.modelId,
        }),
        CONSOLIDATED_INGESTION_QUEUE_URL: consolidatedIngestionQueue.queueUrl,
        ...(sentryDsn ? { SENTRY_DSN: sentryDsn } : {}),
      },
      layers: [lambdaLayers.shared, lambdaLayers.langchain],
      memory: 6144,
      timeout: lambdaTimeout,
      isEnableInsights: true,
      vpc,
      alarmSnsAction: alarmAction,
    });

    bundleBucket.grantReadWrite(theLambda);
    conversionsBucket.grantRead(theLambda);

    featureFlagsTable.grantReadData(theLambda);

    consolidatedIngestionQueue.grantSendMessages(theLambda);

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

  private setupRosterUploadLambdas(ownProps: {
    lambdaLayers: LambdaLayers;
    vpc: ec2.IVpc;
    secrets: Secrets;
    hl7v2RosterBucket: s3.IBucket;
    config: EnvConfig;
    alarmAction: SnsAction | undefined;
  }): Lambda[] {
    const { lambdaLayers, vpc, secrets, hl7v2RosterBucket, config, alarmAction } = ownProps;
    const sentryDsn = config.lambdasSentryDSN;
    const envType = config.environmentType;

    const rosterUploadLambdas: Lambda[] = [];
    if (config.hl7Notification?.hieConfigs) {
      const hl7ScramblerSeedSecret = secrets["HL7_BASE64_SCRAMBLER_SEED"];
      if (!hl7ScramblerSeedSecret) {
        throw new Error(`${hl7ScramblerSeedSecret} is not defined in config`);
      }

      const scramblerSeedSecretName = config.hl7Notification.secrets.HL7_BASE64_SCRAMBLER_SEED;
      const hieConfigs = config.hl7Notification.hieConfigs;

      Object.entries(hieConfigs).forEach(([hieName, hieConfig]) => {
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
            HL7_BASE64_SCRAMBLER_SEED: scramblerSeedSecretName,
            ...(sentryDsn ? { SENTRY_DSN: sentryDsn } : {}),
          },
          layers: [lambdaLayers.shared],
          memory: 4096,
          vpc,
          alarmSnsAction: alarmAction,
        });

        hl7ScramblerSeedSecret.grantRead(lambda);
        hl7v2RosterBucket.grantReadWrite(lambda);

        rosterUploadLambdas.push(lambda);
      });
    }

    return rosterUploadLambdas;
  }
}
