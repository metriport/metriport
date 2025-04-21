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

const waitTimePatientCreate = Duration.seconds(12); // 5 patients/min
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
      alarmMaxAgeOfOldestMessage: Duration.days(2),
      maxMessageCountAlarmThreshold: 5_000,
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
      alarmMaxAgeOfOldestMessage: Duration.minutes(5),
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
  return {
    fileParse,
    patientCreate,
    patientQuery,
  };
}

interface PatientImportNestedStackProps extends NestedStackProps {
  config: EnvConfig;
  vpc: ec2.IVpc;
  alarmAction?: SnsAction;
  lambdaLayers: LambdaLayers;
}

export class PatientImportNestedStack extends NestedStack {
  readonly bucket: s3.Bucket;
  // TODO 2330 rename so it contains "parse" to represent the respective step
  readonly parseLambda: Lambda;
  readonly createLambda: Lambda;
  readonly createQueue: Queue;
  readonly queryLambda: Lambda;
  readonly queryQueue: Queue;

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
      alarmAction: props.alarmAction,
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
      alarmAction: props.alarmAction,
    });
    this.createLambda = create.lambda;
    this.createQueue = create.queue;

    this.parseLambda = this.setupFileParse({
      lambdaLayers: props.lambdaLayers,
      vpc: props.vpc,
      envType: props.config.environmentType,
      bucket: this.bucket,
      patientCreateQueue: this.createQueue,
      sentryDsn: props.config.lambdasSentryDSN,
      alarmAction: props.alarmAction,
    });

    // TODO  2330 Temp solution for MVP, to be merged into parseLambda
    this.setupNotificationLambda({
      lambdaLayers: props.lambdaLayers,
      vpc: props.vpc,
      envType: props.config.environmentType,
      bucket: this.bucket,
      notificationUrl: config.notificationUrl,
      sentryDsn: props.config.lambdasSentryDSN,
      alarmAction: props.alarmAction,
    });
  }

  private setupBucket({ bucketName }: { bucketName: string }): s3.Bucket {
    const bucket = new s3.Bucket(this, "PatientImportBucket", {
      bucketName: bucketName,
      publicReadAccess: false,
      encryption: s3.BucketEncryption.S3_MANAGED,
      versioned: true,
    });
    return bucket;
  }

  private setupFileParse(ownProps: {
    lambdaLayers: LambdaLayers;
    vpc: ec2.IVpc;
    bucket: s3.IBucket;
    envType: EnvType;
    patientCreateQueue: Queue;
    sentryDsn: string | undefined;
    alarmAction: SnsAction | undefined;
  }): Lambda {
    const { lambdaLayers, vpc, bucket, envType, patientCreateQueue, sentryDsn, alarmAction } =
      ownProps;
    const { name, entry, lambdaMemory, lambdaTimeout } = settings().fileParse;

    const lambda = createLambda({
      stack: this,
      name,
      entry,
      envType,
      envVars: {
        PATIENT_IMPORT_BUCKET_NAME: bucket.bucketName,
        PATIENT_IMPORT_CREATE_QUEUE_URL: patientCreateQueue.queueUrl,
        ...(sentryDsn ? { SENTRY_DSN: sentryDsn } : {}),
      },
      layers: [lambdaLayers.shared],
      memory: lambdaMemory,
      timeout: lambdaTimeout,
      vpc,
      alarmSnsAction: alarmAction,
    });

    bucket.grantReadWrite(lambda);
    patientCreateQueue.grantSendMessages(lambda);

    return lambda;
  }

  private setupPatientCreate(ownProps: {
    lambdaLayers: LambdaLayers;
    vpc: ec2.IVpc;
    bucket: s3.IBucket;
    envType: EnvType;
    patientQueryQueue: Queue;
    sentryDsn: string | undefined;
    alarmAction: SnsAction | undefined;
  }): { lambda: Lambda; queue: Queue } {
    const { lambdaLayers, vpc, bucket, patientQueryQueue, envType, sentryDsn, alarmAction } =
      ownProps;
    const {
      name,
      entry,
      lambda: { memory, timeout, batchSize, reportBatchItemFailures },
      queue: {
        visibilityTimeout,
        maxReceiveCount,
        alarmMaxAgeOfOldestMessage,
        maxMessageCountAlarmThreshold,
        createRetryLambda,
      },
      waitTime,
    } = settings().patientCreate;

    const queue = createQueue({
      stack: this,
      name,
      fifo: true,
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
        WAIT_TIME_IN_MILLIS: waitTime.toMilliseconds().toString(),
        PATIENT_IMPORT_BUCKET_NAME: bucket.bucketName,
        PATIENT_IMPORT_QUERY_QUEUE_URL: patientQueryQueue.queueUrl,
        ...(sentryDsn ? { SENTRY_DSN: sentryDsn } : {}),
      },
      layers: [lambdaLayers.shared],
      memory: memory,
      timeout: timeout,
      vpc,
      alarmSnsAction: alarmAction,
    });

    lambda.addEventSource(new SqsEventSource(queue, { batchSize, reportBatchItemFailures }));

    bucket.grantReadWrite(lambda);
    patientQueryQueue.grantSendMessages(lambda);

    return { lambda, queue };
  }

  // TODO  2330 Temp solution for MVP, remove asap
  private setupNotificationLambda(ownProps: {
    lambdaLayers: LambdaLayers;
    vpc: ec2.IVpc;
    bucket: s3.Bucket;
    envType: EnvType;
    notificationUrl: string;
    sentryDsn: string | undefined;
    alarmAction: SnsAction | undefined;
  }): Lambda | undefined {
    const { lambdaLayers, vpc, bucket, envType, notificationUrl, sentryDsn, alarmAction } =
      ownProps;

    const lambda = createLambda({
      stack: this,
      name: "PatientImportUploadNotification",
      entry: "patient-import-upload-notification",
      envType,
      envVars: {
        SLACK_NOTIFICATION_URL: notificationUrl,
        ...(sentryDsn ? { SENTRY_DSN: sentryDsn } : {}),
      },
      layers: [lambdaLayers.shared],
      memory: 512,
      timeout: Duration.seconds(30),
      vpc,
      alarmSnsAction: alarmAction,
    });

    bucket.grantRead(lambda);

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
    alarmAction: SnsAction | undefined;
  }): { lambda: Lambda; queue: Queue } {
    const { lambdaLayers, vpc, bucket, envType, sentryDsn, alarmAction } = ownProps;
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
        WAIT_TIME_IN_MILLIS: waitTime.toMilliseconds().toString(),
        PATIENT_IMPORT_BUCKET_NAME: bucket.bucketName,
        ...(sentryDsn ? { SENTRY_DSN: sentryDsn } : {}),
      },
      layers: [lambdaLayers.shared],
      vpc,
      alarmSnsAction: alarmAction,
    });

    lambda.addEventSource(new SqsEventSource(queue, eventSourceSettings));

    bucket.grantReadWrite(lambda);

    return { lambda, queue };
  }
}
