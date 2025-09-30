import { Duration, NestedStack, NestedStackProps } from "aws-cdk-lib";
import { SnsAction } from "aws-cdk-lib/aws-cloudwatch-actions";
import * as dynamodb from "aws-cdk-lib/aws-dynamodb";
import * as ec2 from "aws-cdk-lib/aws-ec2";
import * as glue from "aws-cdk-lib/aws-glue";
import * as iam from "aws-cdk-lib/aws-iam";
import { Function as Lambda } from "aws-cdk-lib/aws-lambda";
import { SqsEventSource } from "aws-cdk-lib/aws-lambda-event-sources";
import * as s3 from "aws-cdk-lib/aws-s3";
import { Queue } from "aws-cdk-lib/aws-sqs";
import { Construct } from "constructs";
import { EnvType } from "./env-type";
import { createLambda } from "./shared/lambda";
import { LambdaLayers } from "./shared/lambda-layers";
import { Secrets } from "./shared/secrets";
import { QueueAndLambdaSettings } from "./shared/settings";
import { createQueue, provideAccessToQueue } from "./shared/sqs";

interface IHEGatewayV2LambdasNestedStackProps extends NestedStackProps {
  lambdaLayers: LambdaLayers;
  apiTaskRole: iam.IRole;
  vpc: ec2.IVpc;
  secrets: Secrets;
  cqOrgCertificate: string | undefined;
  cqOrgPrivateKey: string | undefined;
  cqOrgPrivateKeyPassword: string | undefined;
  cqOrgCertificateIntermediate: string | undefined;
  cqTrustBundleBucket: s3.IBucket;
  medicalDocumentsBucket: s3.Bucket;
  apiURL: string;
  envType: EnvType;
  sentryDsn: string | undefined;
  iheResponsesBucketName: string;
  iheParsedResponsesBucketName: string;
  alarmAction?: SnsAction;
  featureFlagsTable?: dynamodb.Table;
}

function settings() {
  const writeToS3LambdaTimeout = Duration.seconds(55);
  const writeToS3LambdaMaxBatchingWindow = Duration.seconds(30);
  const writeToS3: Omit<QueueAndLambdaSettings, "waitTime"> = {
    name: "IHEGatewayV2OutboundPatientDiscoveryWriteToS3",
    entry: "ihe-gateway-v2-outbound-patient-discovery-write-to-s3",
    lambda: {
      memory: 2048,
      timeout: writeToS3LambdaTimeout,
    },
    queue: {
      alarmMaxAgeOfOldestMessage: Duration.hours(2),
      maxMessageCountAlarmThreshold: 500_000,
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
  return {
    writeToS3,
  };
}

export class IHEGatewayV2LambdasNestedStack extends NestedStack {
  constructor(scope: Construct, id: string, props: IHEGatewayV2LambdasNestedStackProps) {
    super(scope, id, props);

    this.terminationProtection = true;

    const { lambda: writeToS3LambdaOutboundPD, queue: writeToS3QueueOutboundPD } =
      this.setupWriteToS3OutboundPD({
        lambdaLayers: props.lambdaLayers,
        vpc: props.vpc,
        envType: props.envType,
        sentryDsn: props.sentryDsn,
        alarmAction: props.alarmAction,
      });

    const iheResponsesBucket = new s3.Bucket(this, "IHEResponsesBucket", {
      bucketName: props.iheResponsesBucketName,
      publicReadAccess: false,
      encryption: s3.BucketEncryption.S3_MANAGED,
      versioned: true,
    });

    const iheParsedResponsesBucket = new s3.Bucket(this, "iheParsedResponsesBucket", {
      bucketName: props.iheParsedResponsesBucketName,
      publicReadAccess: false,
      encryption: s3.BucketEncryption.S3_MANAGED,
      versioned: true,
    });

    iheParsedResponsesBucket.grantWrite(writeToS3LambdaOutboundPD);

    this.createParsedReponseTables(iheParsedResponsesBucket);
    this.createParsedReponseProjectionTables(iheParsedResponsesBucket);

    const patientDiscoveryLambda = this.setupIHEGatewayV2PatientDiscoveryLambda(
      props,
      iheResponsesBucket,
      iheParsedResponsesBucket,
      writeToS3QueueOutboundPD
    );
    const documentQueryLambda = this.setupIHEGatewayV2DocumentQueryLambda(
      props,
      iheResponsesBucket
    );
    const documentRetrievalLambda = this.setupIHEGatewayV2DocumentRetrievalLambda(
      props,
      iheResponsesBucket
    );

    // granting lambda invoke access to api service
    patientDiscoveryLambda.grantInvoke(props.apiTaskRole);
    documentQueryLambda.grantInvoke(props.apiTaskRole);
    documentRetrievalLambda.grantInvoke(props.apiTaskRole);
  }

  private createParsedReponseTables(iheParsedResponsesBucket: s3.Bucket) {
    new glue.CfnTable(this, "iheParsedResponsesDebugTable", {
      catalogId: this.account,
      databaseName: "default",
      tableInput: {
        description: "Table used for debugging IHE parsed responses",
        name: "ihe_parsed_responses_by_date",
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
            { name: "ihegatewayv2", type: "boolean" },
            {
              name: "operationoutcome",
              type: "struct<resourcetype:string,id:string,issue:array<struct<severity:string,code:string,details:struct<text:string>>>>",
            },
            // Partition columns flat in data - duplicate columns are prepended "_"
            { name: "_date", type: "string" },
            { name: "cxid", type: "string" },
            { name: "patientid", type: "string" },
            { name: "_stage", type: "string" },
          ],
          compressed: false,
          inputFormat: "org.apache.hadoop.mapred.TextInputFormat",
          outputFormat: "org.apache.hadoop.hive.ql.io.HiveIgnoreKeyTextOutputFormat",
          location: `s3://${iheParsedResponsesBucket.bucketName}/`,
          serdeInfo: { serializationLibrary: "org.openx.data.jsonserde.JsonSerDe" },
        },
        tableType: "EXTERNAL_TABLE",
      },
    });
  }

  private createParsedReponseProjectionTables(iheParsedResponsesBucket: s3.Bucket) {
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
    const locationString: string[] = [];
    for (const [key, value] of Object.entries(partitionKeyMap)) {
      parameters = { ...parameters, ...value.parameters };
      partitionKeys.push(value.partitionKey);
      locationString.push(`${key}=$\{${key}}`);
      new glue.CfnTable(this, `iheParsedResponsesDebugTable_Detail=${key}`, {
        catalogId: this.account,
        databaseName: "default",
        tableInput: {
          description: `Table used for debugging IHE parsed responses using partition projection for ${key}`,
          name: `ihe_parsed_responses_by_date_level_${key}`,
          partitionKeys: [...partitionKeys],
          storageDescriptor: {
            columns: [
              { name: "id", type: "string" },
              { name: "timestamp", type: "string" },
              { name: "requesttimestamp", type: "string" },
              { name: "responsetimestamp", type: "string" },
              { name: "gateway", type: "struct<url:string,oid:string,id:string>" },
              { name: "patientmatch", type: "string" },
              { name: "ihegatewayv2", type: "boolean" },
              {
                name: "operationoutcome",
                type: "struct<resourcetype:string,id:string,issue:array<struct<severity:string,code:string,details:struct<text:string>>>>",
              },
              // Partition columns flat in data - duplicate columns are prepended "_"
              { name: "_date", type: "string" },
              { name: "cxid", type: "string" },
              { name: "patientid", type: "string" },
              { name: "_stage", type: "string" },
            ],
            compressed: false,
            inputFormat: "org.apache.hadoop.mapred.TextInputFormat",
            outputFormat: "org.apache.hadoop.hive.ql.io.HiveIgnoreKeyTextOutputFormat",
            location: `s3://${iheParsedResponsesBucket.bucketName}/`,
            serdeInfo: { serializationLibrary: "org.openx.data.jsonserde.JsonSerDe" },
            parameters: {
              "projection.enabled": "true",
              ...parameters,
              "storage.location.template":
                `s3://${iheParsedResponsesBucket.bucketName}` + locationString,
            },
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
    alarmAction: SnsAction | undefined;
  }): { lambda: Lambda; queue: Queue } {
    const { lambdaLayers, vpc, envType, sentryDsn, alarmAction } = ownProps;
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
      alarmSnsAction: alarmAction,
    });

    const lambda = createLambda({
      ...lambdaSettings,
      stack: this,
      name,
      entry,
      envType,
      envVars: {
        // API_URL set on the api-stack after the OSS API is created
        ...(sentryDsn ? { SENTRY_DSN: sentryDsn } : {}),
      },
      layers: [lambdaLayers.shared],
      vpc,
      alarmSnsAction: alarmAction,
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

  private setupIHEGatewayV2PatientDiscoveryLambda(
    ownProps: {
      lambdaLayers: LambdaLayers;
      vpc: ec2.IVpc;
      secrets: Secrets;
      cqOrgCertificate: string | undefined;
      cqOrgPrivateKey: string | undefined;
      cqOrgPrivateKeyPassword: string | undefined;
      cqOrgCertificateIntermediate: string | undefined;
      medicalDocumentsBucket: s3.Bucket;
      cqTrustBundleBucket: s3.IBucket;
      apiURL: string;
      envType: EnvType;
      sentryDsn: string | undefined;
      featureFlagsTable?: dynamodb.Table;
    },
    iheResponsesBucket: s3.Bucket,
    iheParsedResponsesBucket: s3.Bucket,
    writeToS3Queue: Queue
  ): Lambda {
    const {
      lambdaLayers,
      vpc,
      secrets,
      cqOrgCertificate,
      cqOrgPrivateKey,
      cqOrgPrivateKeyPassword,
      cqOrgCertificateIntermediate,
      medicalDocumentsBucket,
      cqTrustBundleBucket,
      apiURL,
      envType,
      sentryDsn,
      featureFlagsTable,
    } = ownProps;

    const patientDiscoveryLambda = createLambda({
      stack: this,
      name: "IHEGatewayV2OutboundPatientDiscovery",
      entry: "ihe-gateway-v2-outbound-patient-discovery",
      envType: envType,
      envVars: {
        ...(cqOrgPrivateKey !== undefined && { CQ_ORG_PRIVATE_KEY: cqOrgPrivateKey }),
        ...(cqOrgCertificate !== undefined && { CQ_ORG_CERTIFICATE: cqOrgCertificate }),
        ...(cqOrgCertificateIntermediate !== undefined && {
          CQ_ORG_CERTIFICATE_INTERMEDIATE: cqOrgCertificateIntermediate,
        }),
        ...(cqOrgPrivateKeyPassword !== undefined && {
          CQ_ORG_PRIVATE_KEY_PASSWORD: cqOrgPrivateKeyPassword,
        }),
        ...(cqTrustBundleBucket !== undefined && {
          CQ_TRUST_BUNDLE_BUCKET_NAME: cqTrustBundleBucket.bucketName,
        }),
        API_URL: apiURL,
        MEDICAL_DOCUMENTS_BUCKET_NAME: medicalDocumentsBucket.bucketName,
        ...(sentryDsn ? { SENTRY_DSN: sentryDsn } : {}),
        IHE_RESPONSES_BUCKET_NAME: iheResponsesBucket.bucketName,
        IHE_PARSED_RESPONSES_BUCKET_NAME: iheParsedResponsesBucket.bucketName,
        WRITE_TO_S3_QUEUE_URL: writeToS3Queue.queueUrl,
        ...(featureFlagsTable && { FEATURE_FLAGS_TABLE_NAME: featureFlagsTable.tableName }),
      },
      layers: [lambdaLayers.shared],
      memory: 4096,
      timeout: Duration.minutes(10),
      vpc,
    });

    provideAccessToQueue({
      accessType: "send",
      queue: writeToS3Queue,
      resource: patientDiscoveryLambda,
    });

    this.grantSecretsReadAccess(patientDiscoveryLambda, secrets, [
      "CQ_ORG_CERTIFICATE",
      "CQ_ORG_CERTIFICATE_INTERMEDIATE",
      "CQ_ORG_PRIVATE_KEY",
      "CQ_ORG_PRIVATE_KEY_PASSWORD",
    ]);

    iheResponsesBucket.grantReadWrite(patientDiscoveryLambda);
    medicalDocumentsBucket.grantRead(patientDiscoveryLambda);
    cqTrustBundleBucket.grantRead(patientDiscoveryLambda);

    // Grant DynamoDB read access for feature flags
    if (featureFlagsTable) {
      featureFlagsTable.grantReadData(patientDiscoveryLambda);
    }

    return patientDiscoveryLambda;
  }

  private setupIHEGatewayV2DocumentQueryLambda(
    ownProps: {
      lambdaLayers: LambdaLayers;
      vpc: ec2.IVpc;
      secrets: Secrets;
      cqOrgCertificate: string | undefined;
      cqOrgPrivateKey: string | undefined;
      cqOrgPrivateKeyPassword: string | undefined;
      cqOrgCertificateIntermediate: string | undefined;
      cqTrustBundleBucket: s3.IBucket;
      medicalDocumentsBucket: s3.Bucket;
      apiURL: string;
      envType: EnvType;
      sentryDsn: string | undefined;
    },
    iheResponsesBucket: s3.Bucket
  ): Lambda {
    const {
      lambdaLayers,
      vpc,
      secrets,
      cqOrgCertificate,
      cqOrgPrivateKey,
      cqOrgPrivateKeyPassword,
      cqOrgCertificateIntermediate,
      cqTrustBundleBucket,
      medicalDocumentsBucket,
      apiURL,
      envType,
      sentryDsn,
    } = ownProps;

    const documentQueryLambda = createLambda({
      stack: this,
      name: "IHEGatewayV2OutboundDocumentQuery",
      entry: "ihe-gateway-v2-outbound-document-query",
      envType: envType,
      envVars: {
        ...(cqOrgPrivateKey !== undefined && { CQ_ORG_PRIVATE_KEY: cqOrgPrivateKey }),
        ...(cqOrgCertificate !== undefined && { CQ_ORG_CERTIFICATE: cqOrgCertificate }),
        ...(cqOrgCertificateIntermediate !== undefined && {
          CQ_ORG_CERTIFICATE_INTERMEDIATE: cqOrgCertificateIntermediate,
        }),
        ...(cqOrgPrivateKeyPassword !== undefined && {
          CQ_ORG_PRIVATE_KEY_PASSWORD: cqOrgPrivateKeyPassword,
        }),
        ...(cqTrustBundleBucket !== undefined && {
          CQ_TRUST_BUNDLE_BUCKET_NAME: cqTrustBundleBucket.bucketName,
        }),
        API_URL: apiURL,
        ...(sentryDsn ? { SENTRY_DSN: sentryDsn } : {}),
        MEDICAL_DOCUMENTS_BUCKET_NAME: medicalDocumentsBucket.bucketName,
        IHE_RESPONSES_BUCKET_NAME: iheResponsesBucket.bucketName,
      },
      layers: [lambdaLayers.shared],
      memory: 1024,
      timeout: Duration.minutes(10),
      vpc,
    });

    this.grantSecretsReadAccess(documentQueryLambda, secrets, [
      "CQ_ORG_CERTIFICATE",
      "CQ_ORG_CERTIFICATE_INTERMEDIATE",
      "CQ_ORG_PRIVATE_KEY",
      "CQ_ORG_PRIVATE_KEY_PASSWORD",
    ]);

    iheResponsesBucket.grantReadWrite(documentQueryLambda);
    medicalDocumentsBucket.grantRead(documentQueryLambda);
    cqTrustBundleBucket.grantRead(documentQueryLambda);

    return documentQueryLambda;
  }

  private setupIHEGatewayV2DocumentRetrievalLambda(
    ownProps: {
      lambdaLayers: LambdaLayers;
      vpc: ec2.IVpc;
      secrets: Secrets;
      cqOrgCertificate: string | undefined;
      cqOrgPrivateKey: string | undefined;
      cqOrgPrivateKeyPassword: string | undefined;
      cqOrgCertificateIntermediate: string | undefined;
      cqTrustBundleBucket: s3.IBucket;
      medicalDocumentsBucket: s3.Bucket;
      apiURL: string;
      envType: EnvType;
      sentryDsn: string | undefined;
    },
    iheResponsesBucket: s3.Bucket
  ): Lambda {
    const {
      lambdaLayers,
      vpc,
      secrets,
      cqOrgCertificate,
      cqOrgPrivateKey,
      cqOrgPrivateKeyPassword,
      cqOrgCertificateIntermediate,
      cqTrustBundleBucket,
      medicalDocumentsBucket,
      apiURL,
      envType,
      sentryDsn,
    } = ownProps;

    const documentRetrievalLambda = createLambda({
      stack: this,
      name: "IHEGatewayV2OutboundDocumentRetrieval",
      entry: "ihe-gateway-v2-outbound-document-retrieval",
      envType: envType,
      envVars: {
        ...(cqOrgPrivateKey !== undefined && { CQ_ORG_PRIVATE_KEY: cqOrgPrivateKey }),
        ...(cqOrgCertificate !== undefined && { CQ_ORG_CERTIFICATE: cqOrgCertificate }),
        ...(cqOrgCertificateIntermediate !== undefined && {
          CQ_ORG_CERTIFICATE_INTERMEDIATE: cqOrgCertificateIntermediate,
        }),
        ...(cqOrgPrivateKeyPassword !== undefined && {
          CQ_ORG_PRIVATE_KEY_PASSWORD: cqOrgPrivateKeyPassword,
        }),
        ...(cqTrustBundleBucket !== undefined && {
          CQ_TRUST_BUNDLE_BUCKET_NAME: cqTrustBundleBucket.bucketName,
        }),
        API_URL: apiURL,
        ...(sentryDsn ? { SENTRY_DSN: sentryDsn } : {}),
        MEDICAL_DOCUMENTS_BUCKET_NAME: medicalDocumentsBucket.bucketName,
        IHE_RESPONSES_BUCKET_NAME: iheResponsesBucket.bucketName,
      },
      layers: [lambdaLayers.shared],
      memory: 1024,
      timeout: Duration.minutes(15),
      vpc,
    });

    this.grantSecretsReadAccess(documentRetrievalLambda, secrets, [
      "CQ_ORG_CERTIFICATE",
      "CQ_ORG_CERTIFICATE_INTERMEDIATE",
      "CQ_ORG_PRIVATE_KEY",
      "CQ_ORG_PRIVATE_KEY_PASSWORD",
    ]);

    iheResponsesBucket.grantReadWrite(documentRetrievalLambda);
    medicalDocumentsBucket.grantReadWrite(documentRetrievalLambda);
    cqTrustBundleBucket.grantRead(documentRetrievalLambda);

    return documentRetrievalLambda;
  }
}
