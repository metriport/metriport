import { FileStages } from "@metriport/core/command/patient-import/patient-import-shared";
import { Duration, NestedStack, NestedStackProps } from "aws-cdk-lib";
import { SnsAction } from "aws-cdk-lib/aws-cloudwatch-actions";
import * as ec2 from "aws-cdk-lib/aws-ec2";
import { Function as Lambda } from "aws-cdk-lib/aws-lambda";
import { S3EventSource, SqsEventSource } from "aws-cdk-lib/aws-lambda-event-sources";
import * as s3 from "aws-cdk-lib/aws-s3";
import { Queue } from "aws-cdk-lib/aws-sqs";
import { Construct } from "constructs";
import { EnvConfig } from "../config/env-config";
import { EnvType } from "./env-type";
import { createLambda } from "./shared/lambda";
import { LambdaLayers } from "./shared/lambda-layers";
import { QueueAndLambdaSettings } from "./shared/settings";
import { createQueue } from "./shared/sqs";
import { createBucket } from "./shared/bucket";

const waitTimePatientCreate = Duration.seconds(6); // 10 patients/min (assumes single virtual queue across all customers)
const waitTimePatientQuery = Duration.seconds(0);

function settings() {
  const fileParseLambdaTimeout = Duration.minutes(15).minus(Duration.seconds(5));
  const fileParse = {
    name: "PatientImportParse",
    entry: "patient-import-parse",
    lambdaMemory: 2048,
    lambdaTimeout: fileParseLambdaTimeout,
  };
  // 25secs for processinng
  const patientCreateLambdaTimeout = waitTimePatientCreate.plus(Duration.seconds(25));
  const patientCreate: QueueAndLambdaSettings = {
    name: "PatientImportCreate",
    entry: "patient-import-create",
    lambda: {
      memory: 1024,
      timeout: patientCreateLambdaTimeout,
    },
    queue: {
      alertMaxApproximateAgeOfOldestMessage: Duration.days(2),
      alertMaxApproximateNumberOfMessagesVisible: 5_000,
      maxReceiveCount: 3,
      visibilityTimeout: Duration.seconds(patientCreateLambdaTimeout.toSeconds() * 2 + 1),
      createRetryLambda: false,
    },
    eventSource: {
      batchSize: 1,
      reportBatchItemFailures: true,
    },
    waitTime: waitTimePatientCreate,
  };
  // 25secs for processinng
  const patientQueryLambdaTimeout = waitTimePatientQuery.plus(Duration.seconds(25));
  const patientQuery: QueueAndLambdaSettings = {
    name: "PatientImportQuery",
    entry: "patient-import-query",
    lambda: {
      memory: 512,
      timeout: patientQueryLambdaTimeout,
    },
    queue: {
      alertMaxApproximateAgeOfOldestMessage: Duration.minutes(5),
      maxReceiveCount: 3,
      visibilityTimeout: Duration.seconds(patientQueryLambdaTimeout.toSeconds() * 2 + 1),
      createRetryLambda: false,
    },
    eventSource: {
      batchSize: 1,
      reportBatchItemFailures: true,
    },
    waitTime: waitTimePatientQuery,
  };
  const jobResultLambdaTimeout = Duration.minutes(10);
  const jobResult = {
    name: "PatientImportResult",
    entry: "patient-import-result",
    lambdaMemory: 2048,
    lambdaTimeout: jobResultLambdaTimeout,
  };
  return {
    fileParse,
    patientCreate,
    patientQuery,
    jobResult,
  };
}

interface PatientImportNestedStackProps extends NestedStackProps {
  config: EnvConfig;
  vpc: ec2.IVpc;
  alertAction?: SnsAction;
  lambdaLayers: LambdaLayers;
}

export class PatientImportNestedStack extends NestedStack {
  readonly bucket: s3.Bucket;
  readonly parseLambda: Lambda;
  readonly createLambda: Lambda;
  readonly createQueue: Queue;
  readonly queryLambda: Lambda;
  readonly queryQueue: Queue;
  readonly resultLambda: Lambda;

  constructor(scope: Construct, id: string, props: PatientImportNestedStackProps) {
    super(scope, id, props);
    const config = props.config.patientImport;

    this.terminationProtection = true;

    this.bucket = this.setupBucket({
      bucketName: config.bucketName,
    });

    const query = this.setupPatientQuery({
      lambdaLayers: props.lambdaLayers,
      vpc: props.vpc,
      envType: props.config.environmentType,
      bucket: this.bucket,
      sentryDsn: props.config.lambdasSentryDSN,
      alertAction: props.alertAction,
    });
    this.queryLambda = query.lambda;
    this.queryQueue = query.queue;

    const create = this.setupPatientCreate({
      lambdaLayers: props.lambdaLayers,
      vpc: props.vpc,
      envType: props.config.environmentType,
      bucket: this.bucket,
      patientQueryQueue: this.queryQueue,
      sentryDsn: props.config.lambdasSentryDSN,
      alertAction: props.alertAction,
    });
    this.createLambda = create.lambda;
    this.createQueue = create.queue;

    this.resultLambda = this.setupJobResult({
      lambdaLayers: props.lambdaLayers,
      vpc: props.vpc,
      envType: props.config.environmentType,
      bucket: this.bucket,
      sentryDsn: props.config.lambdasSentryDSN,
      alertAction: props.alertAction,
    });

    this.parseLambda = this.setupJobParse({
      lambdaLayers: props.lambdaLayers,
      vpc: props.vpc,
      envType: props.config.environmentType,
      bucket: this.bucket,
      resultLambda: this.resultLambda,
      patientCreateQueue: this.createQueue,
      notificationUrl: config.notificationUrl,
      sentryDsn: props.config.lambdasSentryDSN,
      alertAction: props.alertAction,
    });

    this.setupNotificationLambda({
      lambdaLayers: props.lambdaLayers,
      vpc: props.vpc,
      envType: props.config.environmentType,
      bucket: this.bucket,
      parseLambda: this.parseLambda,
      notificationUrl: config.notificationUrl,
      sentryDsn: props.config.lambdasSentryDSN,
      alertAction: props.alertAction,
    });
  }

  private setupBucket({ bucketName }: { bucketName: string }): s3.Bucket {
    const bucket = createBucket(
      this,
      {
        bucketName: bucketName,
        versioned: true,
      },
      "PatientImportBucket"
    );
    return bucket;
  }

  private setupJobParse(ownProps: {
    lambdaLayers: LambdaLayers;
    vpc: ec2.IVpc;
    bucket: s3.Bucket;
    resultLambda: Lambda;
    envType: EnvType;
    patientCreateQueue: Queue;
    notificationUrl?: string;
    sentryDsn: string | undefined;
    alertAction: SnsAction | undefined;
  }): Lambda {
    if (!ownProps.notificationUrl) throw new Error("Notification URL is required");

    const {
      lambdaLayers,
      vpc,
      bucket,
      envType,
      patientCreateQueue,
      resultLambda,
      sentryDsn,
      alertAction,
    } = ownProps;
    const { name, entry, lambdaMemory, lambdaTimeout } = settings().fileParse;

    const lambda = createLambda({
      stack: this,
      name,
      entry,
      envType,
      envVars: {
        // API URL set on the api-stack after the OSS API is created
        PATIENT_IMPORT_BUCKET_NAME: bucket.bucketName,
        PATIENT_IMPORT_CREATE_QUEUE_URL: patientCreateQueue.queueUrl,
        SLACK_NOTIFICATION_URL: ownProps.notificationUrl,
        PATIENT_IMPORT_RESULT_LAMBDA_NAME: resultLambda.functionName,
        ...(sentryDsn ? { SENTRY_DSN: sentryDsn } : {}),
      },
      layers: [lambdaLayers.shared],
      memory: lambdaMemory,
      timeout: lambdaTimeout,
      vpc,
      alertSnsAction: alertAction,
    });

    bucket.grantReadWrite(lambda);
    patientCreateQueue.grantSendMessages(lambda);
    resultLambda.grantInvoke(lambda);

    return lambda;
  }

  private setupPatientCreate(ownProps: {
    lambdaLayers: LambdaLayers;
    vpc: ec2.IVpc;
    bucket: s3.IBucket;
    envType: EnvType;
    patientQueryQueue: Queue;
    sentryDsn: string | undefined;
    alertAction: SnsAction | undefined;
  }): { lambda: Lambda; queue: Queue } {
    const { lambdaLayers, vpc, bucket, patientQueryQueue, envType, sentryDsn, alertAction } =
      ownProps;
    const {
      name,
      entry,
      lambda: lambdaSettings,
      queue: queueSettings,
      eventSource: eventSourceSettings,
      waitTime,
    } = settings().patientCreate;

    const queue = createQueue({
      ...queueSettings,
      stack: this,
      name,
      fifo: true,
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
        // API_URL set on the api-stack after the OSS API is created
        WAIT_TIME_IN_MILLIS: waitTime.toMilliseconds().toString(),
        PATIENT_IMPORT_BUCKET_NAME: bucket.bucketName,
        PATIENT_IMPORT_QUERY_QUEUE_URL: patientQueryQueue.queueUrl,
        ...(sentryDsn ? { SENTRY_DSN: sentryDsn } : {}),
      },
      layers: [lambdaLayers.shared],
      vpc,
      alertSnsAction: alertAction,
    });

    lambda.addEventSource(new SqsEventSource(queue, eventSourceSettings));

    bucket.grantReadWrite(lambda);
    patientQueryQueue.grantSendMessages(lambda);

    return { lambda, queue };
  }

  private setupNotificationLambda(ownProps: {
    lambdaLayers: LambdaLayers;
    vpc: ec2.IVpc;
    bucket: s3.Bucket;
    parseLambda: Lambda;
    envType: EnvType;
    notificationUrl: string;
    sentryDsn: string | undefined;
    alertAction: SnsAction | undefined;
  }): Lambda | undefined {
    const {
      lambdaLayers,
      vpc,
      bucket,
      parseLambda,
      envType,
      notificationUrl,
      sentryDsn,
      alertAction,
    } = ownProps;

    const lambda = createLambda({
      stack: this,
      name: "PatientImportUploadNotification",
      entry: "patient-import-upload-notification",
      envType,
      envVars: {
        SLACK_NOTIFICATION_URL: notificationUrl,
        PATIENT_IMPORT_PARSE_LAMBDA_NAME: parseLambda.functionName,
        ...(sentryDsn ? { SENTRY_DSN: sentryDsn } : {}),
      },
      layers: [lambdaLayers.shared],
      memory: 512,
      timeout: Duration.seconds(30),
      vpc,
      alertSnsAction: alertAction,
    });

    bucket.grantRead(lambda);
    parseLambda.grantInvoke(lambda);

    const fileName: FileStages = "raw";
    const fileExtension = ".csv";
    const suffix = fileName + fileExtension;

    lambda.addEventSource(
      new S3EventSource(bucket, {
        events: [s3.EventType.OBJECT_CREATED],
        filters: [{ suffix }],
      })
    );

    return lambda;
  }

  private setupPatientQuery(ownProps: {
    lambdaLayers: LambdaLayers;
    vpc: ec2.IVpc;
    bucket: s3.IBucket;
    envType: EnvType;
    sentryDsn: string | undefined;
    alertAction: SnsAction | undefined;
  }): { lambda: Lambda; queue: Queue } {
    const { lambdaLayers, vpc, bucket, envType, sentryDsn, alertAction } = ownProps;
    const {
      name,
      entry,
      lambda: lambdaSettings,
      queue: queueSettings,
      eventSource: eventSourceSettings,
      waitTime,
    } = settings().patientQuery;

    const queue = createQueue({
      ...queueSettings,
      stack: this,
      name,
      fifo: true,
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
        // API_URL set on the api-stack after the OSS API is created
        WAIT_TIME_IN_MILLIS: waitTime.toMilliseconds().toString(),
        PATIENT_IMPORT_BUCKET_NAME: bucket.bucketName,
        ...(sentryDsn ? { SENTRY_DSN: sentryDsn } : {}),
      },
      layers: [lambdaLayers.shared],
      vpc,
      alertSnsAction: alertAction,
    });

    lambda.addEventSource(new SqsEventSource(queue, eventSourceSettings));

    bucket.grantReadWrite(lambda);

    return { lambda, queue };
  }

  private setupJobResult(ownProps: {
    lambdaLayers: LambdaLayers;
    vpc: ec2.IVpc;
    bucket: s3.IBucket;
    envType: EnvType;
    sentryDsn: string | undefined;
    alertAction: SnsAction | undefined;
  }): Lambda {
    const { lambdaLayers, vpc, bucket, envType, sentryDsn, alertAction } = ownProps;
    const { name, entry, lambdaMemory, lambdaTimeout } = settings().jobResult;

    const lambda = createLambda({
      stack: this,
      name,
      entry,
      envType,
      envVars: {
        // API_URL set on the api-stack after the OSS API is created
        PATIENT_IMPORT_BUCKET_NAME: bucket.bucketName,
        ...(sentryDsn ? { SENTRY_DSN: sentryDsn } : {}),
      },
      layers: [lambdaLayers.shared],
      memory: lambdaMemory,
      timeout: lambdaTimeout,
      vpc,
      alertSnsAction: alertAction,
    });

    bucket.grantReadWrite(lambda);

    return lambda;
  }
}
