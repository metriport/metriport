import { Duration, NestedStack, NestedStackProps } from "aws-cdk-lib";
import * as ec2 from "aws-cdk-lib/aws-ec2";
import * as iam from "aws-cdk-lib/aws-iam";
import * as glue from "aws-cdk-lib/aws-glue";
import { Function as Lambda } from "aws-cdk-lib/aws-lambda";
import * as s3 from "aws-cdk-lib/aws-s3";
import { Construct } from "constructs";
import { EnvType } from "./env-type";
import { createLambda } from "./shared/lambda";
import { LambdaLayers } from "./shared/lambda-layers";
import { Secrets } from "./shared/secrets";
import { provideAccessToQueue } from "./shared/sqs";
import { Queue } from "aws-cdk-lib/aws-sqs";
import { SqsEventSource } from "aws-cdk-lib/aws-lambda-event-sources";
import { SnsAction } from "aws-cdk-lib/aws-cloudwatch-actions";
import { createQueue } from "./shared/sqs";

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
}

function settings() {
  const writeToS3LambdaTimeout = Duration.seconds(25);
  const writeToS3LambdaMaxBatchingWindow = Duration.seconds(5);
  const writeToS3: QueueAndLambdaSettings = {
    name: "IHEGatewayV2OutboundPatientDiscoveryWriteToS3",
    entry: "ihe-gateway-v2-outbound-patient-discovery-write-to-s3",
    lambda: {
      memory: 2048,
      batchSize: 100,
      maxBatchingWindow: writeToS3LambdaMaxBatchingWindow,
      timeout: writeToS3LambdaTimeout,
      reportBatchItemFailures: true,
    },
    queue: {
      alarmMaxAgeOfOldestMessage: Duration.hours(2),
      maxMessageCountAlarmThreshold: 5_000,
      maxReceiveCount: 3,
      visibilityTimeout: Duration.seconds(writeToS3LambdaTimeout.toSeconds() * 2 + 1),
      createRetryLambda: false,
    },
  };
  return {
    writeToS3,
  };
}

type QueueAndLambdaSettings = {
  name: string;
  entry: string;
  lambda: {
    memory: 512 | 1024 | 2048 | 4096;
    /** Number of messages the lambda pull from SQS at once  */
    batchSize: number;
    maxBatchingWindow: Duration;
    /** How long can the lambda run for, max is 900 seconds (15 minutes)  */
    timeout: Duration;
    /** Partial batch response: https://docs.aws.amazon.com/prescriptive-guidance/latest/lambda-event-filtering-partial-batch-responses-for-sqs/welcome.html */
    reportBatchItemFailures: boolean;
  };
  queue: {
    alarmMaxAgeOfOldestMessage: Duration;
    maxMessageCountAlarmThreshold?: number;
    /** The number of times a message can be unsuccesfully dequeued before being moved to the dead-letter queue. */
    maxReceiveCount: number;
    /** How long messages should be invisible for other consumers, based on the lambda timeout */
    /** We don't care if the message gets reprocessed, so no need to have a huge visibility timeout that makes it harder to move messages to the DLQ */
    visibilityTimeout: Duration;
    createRetryLambda: boolean;
  };
};

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
      lambda: { memory, timeout, batchSize, maxBatchingWindow, reportBatchItemFailures },
      queue: {
        visibilityTimeout,
        maxReceiveCount,
        alarmMaxAgeOfOldestMessage,
        maxMessageCountAlarmThreshold,
        createRetryLambda,
      },
    } = settings().writeToS3;

    const queue = createQueue({
      stack: this,
      name,
      createDLQ: true,
      visibilityTimeout,
      maxReceiveCount,
      lambdaLayers: [lambdaLayers.shared],
      envType,
      alarmSnsAction: alarmAction,
      alarmMaxAgeOfOldestMessage,
      maxMessageCountAlarmThreshold,
      createRetryLambda,
    });

    const lambda = createLambda({
      stack: this,
      name,
      entry,
      envType,
      envVars: {
        // API_URL set on the api-stack after the OSS API is created
        ...(sentryDsn ? { SENTRY_DSN: sentryDsn } : {}),
      },
      layers: [lambdaLayers.shared],
      memory: memory,
      timeout: timeout,
      vpc,
      alarmSnsAction: alarmAction,
    });

    lambda.addEventSource(
      new SqsEventSource(queue, { batchSize, reportBatchItemFailures, maxBatchingWindow })
    );

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
