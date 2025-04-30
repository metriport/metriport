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
import { Queue } from "aws-cdk-lib/aws-sqs";
import { Construct } from "constructs";
import { EnvConfig } from "../config/env-config";
import * as fhirConverterConnector from "./api-stack/fhir-converter-connector";
import { FHIRConverterConnector } from "./api-stack/fhir-converter-connector";
import { EnvType } from "./env-type";
import { addBedrockPolicyToLambda } from "./shared/bedrock";
import { createLambda, MAXIMUM_LAMBDA_TIMEOUT } from "./shared/lambda";
import { LambdaLayers, setupLambdasLayers } from "./shared/lambda-layers";
import { createScheduledLambda } from "./shared/lambda-scheduled";
import { Secrets } from "./shared/secrets";
import { createQueue } from "./shared/sqs";
import { isSandbox } from "./shared/util";

export const CDA_TO_VIS_TIMEOUT = Duration.minutes(15);

const pollingBuffer = Duration.seconds(30);

interface LambdasNestedStackProps extends NestedStackProps {
  config: EnvConfig;
  vpc: ec2.IVpc;
  secrets: Secrets;
  dbCluster: rds.IDatabaseCluster;
  dbCredsSecret: secret.ISecret;
  medicalDocumentsBucket: s3.Bucket;
  sandboxSeedDataBucket: s3.IBucket | undefined;
  alarmAction?: SnsAction;
  featureFlagsTable: dynamodb.Table;
  bedrock: { modelId: string; region: string; anthropicVersion: string } | undefined;
}

type GenericConsolidatedLambdaProps = {
  name: string;
  entry: string;
  memory: number;
  lambdaLayers: LambdaLayers;
  vpc: ec2.IVpc;
  bundleBucket: s3.IBucket;
  conversionsBucket: s3.IBucket;
  envType: EnvType;
  sentryDsn: string | undefined;
  alarmAction: SnsAction | undefined;
  featureFlagsTable: dynamodb.Table;
  bedrock: { modelId: string; region: string; anthropicVersion: string } | undefined;
};

type ConsolidatedLambdaProps = Omit<GenericConsolidatedLambdaProps, "name" | "entry" | "memory">;

type ConsolidatedLambdaParams = {
  fhirServerUrl: string;
};

export class LambdasNestedStack extends NestedStack {
  readonly lambdaLayers: LambdaLayers;
  readonly cdaToVisualizationLambda: Lambda;
  readonly documentDownloaderLambda: lambda.Function;
  readonly fhirToCdaConverterLambda: lambda.Function;
  readonly outboundPatientDiscoveryLambda: lambda.Function;
  readonly outboundDocumentQueryLambda: lambda.Function;
  readonly outboundDocumentRetrievalLambda: lambda.Function;
  readonly fhirToBundleLambda: lambda.Function;
  readonly fhirToBundleCountLambda: lambda.Function;
  readonly fhirConverterConnector: FHIRConverterConnector;
  readonly acmCertificateMonitorLambda: Lambda;
  readonly hl7v2RosterUploadLambda: Lambda | undefined;
  readonly conversionResultNotifierLambda: lambda.Function;
  constructor(scope: Construct, id: string, props: LambdasNestedStackProps) {
    super(scope, id, props);

    this.terminationProtection = true;

    this.lambdaLayers = setupLambdasLayers(this);

    this.cdaToVisualizationLambda = this.setupCdaToVisualization({
      lambdaLayers: this.lambdaLayers,
      vpc: props.vpc,
      envType: props.config.environmentType,
      medicalDocumentsBucket: props.medicalDocumentsBucket,
      sandboxSeedDataBucket: props.sandboxSeedDataBucket,
      sentryDsn: props.config.lambdasSentryDSN,
      alarmAction: props.alarmAction,
    });

    this.documentDownloaderLambda = this.setupDocumentDownloader({
      lambdaLayers: this.lambdaLayers,
      vpc: props.vpc,
      secrets: props.secrets,
      cwOrgCertificate: props.config.cwSecretNames.CW_ORG_CERTIFICATE,
      cwOrgPrivateKey: props.config.cwSecretNames.CW_ORG_PRIVATE_KEY,
      bucketName: props.medicalDocumentsBucket.bucketName,
      envType: props.config.environmentType,
      sentryDsn: props.config.lambdasSentryDSN,
    });

    this.fhirToCdaConverterLambda = this.setupFhirToCdaConverterLambda({
      lambdaLayers: this.lambdaLayers,
      vpc: props.vpc,
      medicalDocumentsBucket: props.medicalDocumentsBucket,
      envType: props.config.environmentType,
      systemRootOid: props.config.systemRootOID,
      sentryDsn: props.config.lambdasSentryDSN,
    });

    this.outboundPatientDiscoveryLambda = this.setupOutboundPatientDiscovery({
      lambdaLayers: this.lambdaLayers,
      vpc: props.vpc,
      envType: props.config.environmentType,
      sentryDsn: props.config.lambdasSentryDSN,
      alarmAction: props.alarmAction,
      dbCluster: props.dbCluster,
      dbCredsSecret: props.dbCredsSecret,
      // TODO move this to a config
      maxPollingDuration: Duration.minutes(2),
    });

    this.outboundDocumentQueryLambda = this.setupOutboundDocumentQuery({
      lambdaLayers: this.lambdaLayers,
      vpc: props.vpc,
      envType: props.config.environmentType,
      sentryDsn: props.config.lambdasSentryDSN,
      alarmAction: props.alarmAction,
      dbCluster: props.dbCluster,
      dbCredsSecret: props.dbCredsSecret,
      // TODO move this to a config
      maxPollingDuration: Duration.minutes(15),
    });

    this.outboundDocumentRetrievalLambda = this.setupOutboundDocumentRetrieval({
      lambdaLayers: this.lambdaLayers,
      vpc: props.vpc,
      envType: props.config.environmentType,
      sentryDsn: props.config.lambdasSentryDSN,
      alarmAction: props.alarmAction,
      dbCluster: props.dbCluster,
      dbCredsSecret: props.dbCredsSecret,
      // TODO move this to a config
      maxPollingDuration: Duration.minutes(15),
    });

    const resultNotifierConnector = this.setupConversionResultNotifier({
      vpc: props.vpc,
      config: props.config,
      alarmAction: props.alarmAction,
    });
    const conversionResultNotifierQueue = resultNotifierConnector.queue;
    this.conversionResultNotifierLambda = resultNotifierConnector.lambda;

    this.fhirConverterConnector = fhirConverterConnector.create({
      stack: this,
      vpc: props.vpc,
      lambdaLayers: this.lambdaLayers,
      envType: props.config.environmentType,
      config: props.config,
      featureFlagsTable: props.featureFlagsTable,
      medicalDocumentsBucket: props.medicalDocumentsBucket,
      apiNotifierQueue: conversionResultNotifierQueue,
      alarmSnsAction: props.alarmAction,
    });

    this.fhirToBundleLambda = this.setupFhirBundleLambda({
      lambdaLayers: this.lambdaLayers,
      vpc: props.vpc,
      fhirServerUrl: props.config.fhirServerUrl,
      bundleBucket: props.medicalDocumentsBucket,
      conversionsBucket: this.fhirConverterConnector.bucket,
      envType: props.config.environmentType,
      sentryDsn: props.config.lambdasSentryDSN,
      alarmAction: props.alarmAction,
      featureFlagsTable: props.featureFlagsTable,
      bedrock: props.config.bedrock,
    });
    this.fhirToBundleCountLambda = this.setupFhirBundleCountLambda({
      lambdaLayers: this.lambdaLayers,
      vpc: props.vpc,
      bundleBucket: props.medicalDocumentsBucket,
      conversionsBucket: this.fhirConverterConnector.bucket,
      envType: props.config.environmentType,
      sentryDsn: props.config.lambdasSentryDSN,
      alarmAction: props.alarmAction,
      featureFlagsTable: props.featureFlagsTable,
      bedrock: props.config.bedrock,
    });

    this.acmCertificateMonitorLambda = this.setupAcmCertificateMonitor({
      lambdaLayers: this.lambdaLayers,
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

      this.hl7v2RosterUploadLambda = this.setupRosterUploadLambda({
        lambdaLayers: this.lambdaLayers,
        vpc: props.vpc,
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
  }: {
    vpc: ec2.IVpc;
    alarmAction: SnsAction | undefined;
    config: EnvConfig;
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
      layers: [this.lambdaLayers.shared],
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
  private setupFhirBundleLambda(
    params: ConsolidatedLambdaProps & ConsolidatedLambdaParams
  ): Lambda {
    return this.setupGenericConsolidatedLambda({
      ...params,
      name: "FhirToBundle",
      entry: "fhir-to-bundle",
      memory: 2048,
    });
  }
  private setupFhirBundleCountLambda(params: ConsolidatedLambdaProps): Lambda {
    return this.setupGenericConsolidatedLambda({
      ...params,
      name: "FhirToBundleCount",
      entry: "fhir-to-bundle-count",
      memory: 2048,
    });
  }

  private setupGenericConsolidatedLambda({
    name,
    entry,
    memory,
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
  }: GenericConsolidatedLambdaProps & Partial<ConsolidatedLambdaParams>): Lambda {
    const lambdaTimeout = MAXIMUM_LAMBDA_TIMEOUT.minus(Duration.seconds(5));

    const fhirToBundleLambda = createLambda({
      stack: this,
      name,
      runtime: lambda.Runtime.NODEJS_20_X,
      entry,
      envType,
      envVars: {
        // API_URL set on the api-stack after the OSS API is created
        ...(fhirServerUrl && { FHIR_SERVER_URL: fhirServerUrl }),
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
        ...(sentryDsn ? { SENTRY_DSN: sentryDsn } : {}),
      },
      layers: [lambdaLayers.shared, lambdaLayers.langchain],
      memory,
      timeout: lambdaTimeout,
      isEnableInsights: true,
      vpc,
      alarmSnsAction: alarmAction,
    });

    bundleBucket.grantReadWrite(fhirToBundleLambda);
    conversionsBucket.grantRead(fhirToBundleLambda);

    featureFlagsTable.grantReadData(fhirToBundleLambda);

    addBedrockPolicyToLambda(fhirToBundleLambda);

    return fhirToBundleLambda;
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
      name: "AcmCertificateMonitor",
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

  private setupRosterUploadLambda(ownProps: {
    lambdaLayers: LambdaLayers;
    vpc: ec2.IVpc;
    hl7v2RosterBucket: s3.IBucket;
    config: EnvConfig;
    alarmAction: SnsAction | undefined;
  }): Lambda {
    const { lambdaLayers, vpc, hl7v2RosterBucket, config, alarmAction } = ownProps;
    const sentryDsn = config.lambdasSentryDSN;
    const envType = config.environmentType;

    const hl7v2RosterUploadLambda = createLambda({
      stack: this,
      name: "Hl7v2RosterUpload",
      entry: "hl7v2-roster",
      envType,
      envVars: {
        BUCKET_NAME: hl7v2RosterBucket.bucketName,
        API_URL: config.loadBalancerDnsName,
        ...(sentryDsn ? { SENTRY_DSN: sentryDsn } : {}),
      },
      layers: [lambdaLayers.shared],
      memory: 4096,
      vpc,
      alarmSnsAction: alarmAction,
    });

    hl7v2RosterBucket.grantReadWrite(hl7v2RosterUploadLambda);

    return hl7v2RosterUploadLambda;
  }
}
