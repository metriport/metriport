import { Duration, NestedStack, NestedStackProps } from "aws-cdk-lib";
import { SnsAction } from "aws-cdk-lib/aws-cloudwatch-actions";
import * as ec2 from "aws-cdk-lib/aws-ec2";
import * as iam from "aws-cdk-lib/aws-iam";
import * as lambda from "aws-cdk-lib/aws-lambda";
import { Function as Lambda } from "aws-cdk-lib/aws-lambda";
import * as rds from "aws-cdk-lib/aws-rds";
import * as s3 from "aws-cdk-lib/aws-s3";
import * as secret from "aws-cdk-lib/aws-secretsmanager";
import { Construct } from "constructs";
import { EnvConfig } from "../config/env-config";
import * as fhirConverterConnector from "./api-stack/fhir-converter-connector";
import { FHIRConverterConnector } from "./api-stack/fhir-converter-connector";
import { EnvType } from "./env-type";
import * as AppConfigUtils from "./shared/app-config";
import { createLambda, MAXIMUM_LAMBDA_TIMEOUT } from "./shared/lambda";
import { LambdaLayers, setupLambdasLayers } from "./shared/lambda-layers";
import { Secrets } from "./shared/secrets";

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
  appConfigEnvVars: {
    appId: string;
    configId: string;
  };
  bedrock: { modelId: string; region: string; anthropicVersion: string } | undefined;
}

export class LambdasNestedStack extends NestedStack {
  readonly lambdaLayers: LambdaLayers;
  // TODO 1672 Remove this
  readonly cdaToVisualizationLambda: Lambda;
  readonly cdaToVisualizationLambda3: Lambda;
  readonly documentDownloaderLambda: lambda.Function;
  readonly fhirToCdaConverterLambda: lambda.Function;
  readonly outboundPatientDiscoveryLambda: lambda.Function;
  readonly outboundDocumentQueryLambda: lambda.Function;
  readonly outboundDocumentRetrievalLambda: lambda.Function;
  readonly fhirToBundleLambda: lambda.Function;
  readonly fhirConverterConnector: FHIRConverterConnector;

  constructor(scope: Construct, id: string, props: LambdasNestedStackProps) {
    super(scope, id, props);

    this.terminationProtection = true;

    this.lambdaLayers = setupLambdasLayers(this);

    // TODO 1672 Remove this
    this.cdaToVisualizationLambda = this.setupCdaToVisualization({
      lambdaLayers: this.lambdaLayers,
      vpc: props.vpc,
      envType: props.config.environmentType,
      medicalDocumentsBucket: props.medicalDocumentsBucket,
      sandboxSeedDataBucket: props.sandboxSeedDataBucket,
      sentryDsn: props.config.lambdasSentryDSN,
      alarmAction: props.alarmAction,
    });
    this.cdaToVisualizationLambda3 = this.setupCdaToVisualization3({
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

    this.fhirConverterConnector = fhirConverterConnector.createQueueAndBucket({
      stack: this,
      lambdaLayers: this.lambdaLayers,
      envType: props.config.environmentType,
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
      appId: props.appConfigEnvVars.appId,
      configId: props.appConfigEnvVars.configId,
      bedrock: props.config.bedrock,
    });
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

  private setupCdaToVisualization3(ownProps: {
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
      nameSuffix: "v3",
      entry: "cda-to-visualization3",
      envType,
      envVars: {
        ...(sentryDsn ? { SENTRY_DSN: sentryDsn } : {}),
      },
      layers: [
        lambdaLayers.shared,
        lambdaLayers.chromium,
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

  /** AKA, get consolidated lambda */
  private setupFhirBundleLambda({
    lambdaLayers,
    vpc,
    fhirServerUrl,
    bundleBucket,
    conversionsBucket,
    sentryDsn,
    envType,
    alarmAction,
    appId,
    configId,
    bedrock,
  }: {
    lambdaLayers: LambdaLayers;
    vpc: ec2.IVpc;
    fhirServerUrl: string;
    bundleBucket: s3.IBucket;
    conversionsBucket: s3.IBucket;
    envType: EnvType;
    sentryDsn: string | undefined;
    alarmAction: SnsAction | undefined;
    appId: string;
    configId: string;
    bedrock: { modelId: string; region: string; anthropicVersion: string } | undefined;
  }): Lambda {
    const lambdaTimeout = MAXIMUM_LAMBDA_TIMEOUT.minus(Duration.seconds(5));

    const fhirToBundleLambda = createLambda({
      stack: this,
      name: "FhirToBundle",
      runtime: lambda.Runtime.NODEJS_18_X,
      entry: "fhir-to-bundle",
      envType,
      envVars: {
        // API_URL set on the api-stack after the OSS API is created
        FHIR_SERVER_URL: fhirServerUrl,
        BUCKET_NAME: bundleBucket.bucketName,
        MEDICAL_DOCUMENTS_BUCKET_NAME: bundleBucket.bucketName,
        CONVERSION_RESULT_BUCKET_NAME: conversionsBucket.bucketName,
        APPCONFIG_APPLICATION_ID: appId,
        APPCONFIG_CONFIGURATION_ID: configId,
        ...(bedrock && {
          // API_URL set on the api-stack after the OSS API is created
          BEDROCK_REGION: bedrock?.region,
          BEDROCK_VERSION: bedrock?.anthropicVersion,
          AI_BRIEF_MODEL_ID: bedrock?.modelId,
        }),
        ...(sentryDsn ? { SENTRY_DSN: sentryDsn } : {}),
      },
      layers: [lambdaLayers.shared, lambdaLayers.langchain],
      memory: 4096,
      timeout: lambdaTimeout,
      isEnableInsights: true,
      vpc,
      alarmSnsAction: alarmAction,
    });

    bundleBucket.grantReadWrite(fhirToBundleLambda);
    conversionsBucket.grantRead(fhirToBundleLambda);

    AppConfigUtils.allowReadConfig({
      scope: this,
      resourceName: "FhirToBundleLambda",
      resourceRole: fhirToBundleLambda.role,
      appConfigResources: ["*"],
    });

    const bedrockPolicyStatement = new iam.PolicyStatement({
      actions: ["bedrock:InvokeModel"],
      resources: [
        `arn:aws:bedrock:*:*:foundation-model/*`,
        `arn:aws:bedrock:*:*:inference-profile/*`,
        `arn:aws:bedrock:*:*:application-inference-profile/*`,
      ],
    });

    fhirToBundleLambda.addToRolePolicy(bedrockPolicyStatement);

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
}
