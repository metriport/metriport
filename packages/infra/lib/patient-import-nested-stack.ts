import { Duration, NestedStack, NestedStackProps } from "aws-cdk-lib";
import { SnsAction } from "aws-cdk-lib/aws-cloudwatch-actions";
import * as ec2 from "aws-cdk-lib/aws-ec2";
import { Function as Lambda } from "aws-cdk-lib/aws-lambda";
import { SqsEventSource } from "aws-cdk-lib/aws-lambda-event-sources";
import * as s3 from "aws-cdk-lib/aws-s3";
import { IBucket } from "aws-cdk-lib/aws-s3";
import { Queue } from "aws-cdk-lib/aws-sqs";
import { Construct } from "constructs";
import { EnvConfig } from "../config/env-config";
import { EnvType } from "./env-type";
import { createLambda } from "./shared/lambda";
import { LambdaLayers } from "./shared/lambda-layers";
import { createQueue } from "./shared/sqs";

const waitTimePatientCreateInSeconds = 300; // 5min
const waitTimePatientQueryInSeconds = 0;

function settings() {
  const fileImportLambdaTimeout = Duration.minutes(15).minus(Duration.seconds(5));
  const fileImport = {
    name: "PatientImportFile",
    entry: "patient-import-file",
    lambdaMemory: 2048,
    lambdaTimeout: fileImportLambdaTimeout,
  };
  const waitTimePatientCreate = Duration.seconds(waitTimePatientCreateInSeconds);
  const patientCreateLambdaTimeout = Duration.seconds(waitTimePatientCreateInSeconds + 30).minus(
    Duration.seconds(5)
  ); // 25secs for processinng
  const patientCreate: QueueAndLambdaSettings = {
    name: "PatientImportCreate",
    entry: "patient-import-create",
    lambda: {
      memory: 1024,
      batchSize: 1,
      timeout: patientCreateLambdaTimeout,
      reportBatchItemFailures: true,
    },
    queue: {
      alarmMaxAgeOfOldestMessage: patientCreateLambdaTimeout.minus(Duration.seconds(10)),
      maxMessageCountAlarmThreshold: 5_000,
      maxReceiveCount: 3,
      visibilityTimeout: Duration.seconds(patientCreateLambdaTimeout.toSeconds() * 2 + 1),
      createRetryLambda: false,
    },
    waitTime: waitTimePatientCreate,
  };
  const waitTimePatientQuery = Duration.seconds(waitTimePatientQueryInSeconds);
  const patientQueryLambdaTimeout = Duration.seconds(waitTimePatientQueryInSeconds + 30).minus(
    Duration.seconds(5)
  ); // 25secs for processinng
  const patientQuery: QueueAndLambdaSettings = {
    name: "PatientImportQuery",
    entry: "patient-import-query",
    lambda: {
      memory: 512,
      batchSize: 1,
      timeout: patientQueryLambdaTimeout,
      reportBatchItemFailures: true,
    },
    queue: {
      alarmMaxAgeOfOldestMessage: patientQueryLambdaTimeout.minus(Duration.seconds(10)),
      maxReceiveCount: 3,
      visibilityTimeout: Duration.seconds(patientQueryLambdaTimeout.toSeconds() * 2 + 1),
      createRetryLambda: false,
    },
    waitTime: waitTimePatientQuery,
  };
  return {
    fileImport,
    patientCreate,
    patientQuery,
  };
}

type QueueAndLambdaSettings = {
  name: string;
  entry: string;
  lambda: {
    memory: 512 | 1024 | 2048 | 4096;
    /** Number of messages the lambda pull from SQS at once  */
    batchSize: number;
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
  waitTime: Duration;
};

interface PatientImportNestedStackProps extends NestedStackProps {
  config: EnvConfig;
  vpc: ec2.IVpc;
  alarmAction?: SnsAction;
  lambdaLayers: LambdaLayers;
}

export class PatientImportNestedStack extends NestedStack {
  readonly bucket: IBucket;
  readonly importFileLambda: Lambda;
  readonly patientCreateLambda: Lambda;
  readonly patientCreateQueue: Queue;
  readonly patientQueryLambda: Lambda;
  readonly patientQueryQueue: Queue;

  constructor(scope: Construct, id: string, props: PatientImportNestedStackProps) {
    super(scope, id, props);
    const config = props.config.patientImport;

    this.terminationProtection = true;

    this.bucket = this.setupBucket({
      bucketName: config.bucketName,
    });

    const patientQuery = this.setupPatientQuery({
      lambdaLayers: props.lambdaLayers,
      vpc: props.vpc,
      envType: props.config.environmentType,
      bucket: this.bucket,
      sentryDsn: props.config.lambdasSentryDSN,
      alarmAction: props.alarmAction,
    });
    this.patientQueryLambda = patientQuery.lambda;
    this.patientQueryQueue = patientQuery.queue;

    const patientCreate = this.setupPatientCreate({
      lambdaLayers: props.lambdaLayers,
      vpc: props.vpc,
      envType: props.config.environmentType,
      bucket: this.bucket,
      patientQueryQueue: this.patientQueryQueue,
      sentryDsn: props.config.lambdasSentryDSN,
      alarmAction: props.alarmAction,
    });
    this.patientCreateLambda = patientCreate.lambda;
    this.patientCreateQueue = patientCreate.queue;

    this.importFileLambda = this.setupLambdaImportFile({
      lambdaLayers: props.lambdaLayers,
      vpc: props.vpc,
      envType: props.config.environmentType,
      bucket: this.bucket,
      patientCreateQueue: this.patientCreateQueue,
      sentryDsn: props.config.lambdasSentryDSN,
      alarmAction: props.alarmAction,
    });
  }

  private setupBucket({ bucketName }: { bucketName: string }): IBucket {
    const bucket = new s3.Bucket(this, "PatientImportBucket", {
      bucketName: bucketName,
      publicReadAccess: false,
      encryption: s3.BucketEncryption.S3_MANAGED,
      versioned: true,
    });
    return bucket;
  }

  private setupLambdaImportFile(ownProps: {
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
    const { name, entry, lambdaMemory, lambdaTimeout } = settings().fileImport;

    const lambda = createLambda({
      stack: this,
      name,
      entry,
      envType,
      envVars: {
        PATIENT_IMPORT_BUCKET_NAME: bucket.bucketName,
        PATIENT_CREATE_QUEUE_URL: patientCreateQueue.queueUrl,
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
        PATIENT_QUERY_QUEUE_URL: patientQueryQueue.queueUrl,
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
      lambda: { memory, timeout, batchSize, reportBatchItemFailures },
      queue: {
        visibilityTimeout,
        maxReceiveCount,
        alarmMaxAgeOfOldestMessage,
        maxMessageCountAlarmThreshold,
        createRetryLambda,
      },
      waitTime,
    } = settings().patientQuery;

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

    return { lambda, queue };
  }
}
