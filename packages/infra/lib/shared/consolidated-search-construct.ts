import { SnsAction } from "aws-cdk-lib/aws-cloudwatch-actions";
import * as dynamodb from "aws-cdk-lib/aws-dynamodb";
import * as ec2 from "aws-cdk-lib/aws-ec2";
import { Function as Lambda } from "aws-cdk-lib/aws-lambda";
import { SqsEventSource } from "aws-cdk-lib/aws-lambda-event-sources";
import * as s3 from "aws-cdk-lib/aws-s3";
import { ISecret } from "aws-cdk-lib/aws-secretsmanager";
import { IQueue } from "aws-cdk-lib/aws-sqs";
import { Construct } from "constructs";
import { EnvConfig } from "../../config/env-config";
import { EnvType } from "../env-type";
import {
  getConsolidatedIngestionConnectorSettings,
  getConsolidatedSearchConnectorSettings,
} from "../lambdas-nested-stack-settings";
import { createLambda } from "./lambda";
import { LambdaLayers } from "./lambda-layers";
import { Secrets } from "./secrets";
import { createQueue } from "./sqs";

export type OpenSearchConfigForLambdas = {
  endpoint: string;
  auth: { userName: string; secret: ISecret };
  consolidatedIndexName: string;
  documentIndexName: string;
};

export interface ConsolidatedSearchConstructProps {
  config: EnvConfig;
  vpc: ec2.IVpc;
  lambdaLayers: LambdaLayers;
  secrets: Secrets;
  medicalDocumentsBucket: s3.Bucket;
  alarmAction?: SnsAction;
  featureFlagsTable: dynamodb.Table;
  openSearch: OpenSearchConfigForLambdas;
}

export default class ConsolidatedSearchConstruct extends Construct {
  readonly consolidatedSearchLambda: Lambda;
  readonly consolidatedIngestionLambda: Lambda;
  readonly consolidatedIngestionQueue: IQueue;

  constructor(scope: Construct, id: string, props: ConsolidatedSearchConstructProps) {
    super(scope, `${id}Construct`);

    this.consolidatedIngestionQueue = this.setupConsolidatedIngestionQueue({
      envType: props.config.environmentType,
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
}
