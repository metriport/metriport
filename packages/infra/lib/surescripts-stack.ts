import { Duration, NestedStack, NestedStackProps } from "aws-cdk-lib";
import { SnsAction } from "aws-cdk-lib/aws-cloudwatch-actions";
import * as ec2 from "aws-cdk-lib/aws-ec2";
import { Function as Lambda } from "aws-cdk-lib/aws-lambda";
import { SqsEventSource } from "aws-cdk-lib/aws-lambda-event-sources";
import * as s3 from "aws-cdk-lib/aws-s3";
import { Queue } from "aws-cdk-lib/aws-sqs";
import { Construct } from "constructs";
import { EnvConfig } from "../config/env-config";
import { EnvType } from "./env-type";
import { createLambda } from "./shared/lambda";
import { LambdaLayers } from "./shared/lambda-layers";
import { QueueAndLambdaSettings } from "./shared/settings";
import { createQueue } from "./shared/sqs";

const waitTimePatientSync = Duration.seconds(10); // 6 patients/min
const waitTimeRefreshBundle = Duration.seconds(0); // No limit

function settings(): {
  synchronizeSftp: QueueAndLambdaSettings;
  generateRequest: QueueAndLambdaSettings;
  parseVerification: QueueAndLambdaSettings;
  parseResponse: QueueAndLambdaSettings;
} {
  const syncPatientLambdaTimeout = waitTimePatientSync.plus(Duration.seconds(25));
  const synchronizeSftp: QueueAndLambdaSettings = {
    name: "SurescriptsSynchronizeSftp",
    entry: "surescripts-synchronize-sftp",
    lambda: {
      memory: 512,
      timeout: syncPatientLambdaTimeout,
    },
    queue: {
      alarmMaxAgeOfOldestMessage: Duration.hours(6),
      maxMessageCountAlarmThreshold: 5_000,
      maxReceiveCount: 3,
      visibilityTimeout: Duration.seconds(syncPatientLambdaTimeout.toSeconds() * 2 + 1),
      createRetryLambda: false,
    },
    eventSource: {
      batchSize: 1,
      reportBatchItemFailures: true,
    },
    waitTime: waitTimePatientSync,
  };

  // Skip adding the wait time to the lambda timeout because it's already sub 1 second
  const generateRequestLambdaTimeout = Duration.minutes(12);
  const generateRequest: QueueAndLambdaSettings = {
    name: "SurescriptsGenerateRequest",
    entry: "surescripts-generate-request",
    lambda: {
      memory: 1024,
      timeout: generateRequestLambdaTimeout,
    },
    queue: {
      alarmMaxAgeOfOldestMessage: Duration.hours(1),
      maxMessageCountAlarmThreshold: 15_000,
      maxReceiveCount: 3,
      visibilityTimeout: Duration.seconds(generateRequestLambdaTimeout.toSeconds() * 2 + 1),
      createRetryLambda: false,
    },
    eventSource: {
      batchSize: 1,
      reportBatchItemFailures: true,
      maxConcurrency: 4,
    },
    waitTime: waitTimeRefreshBundle,
  };

  // Skip adding the wait time to the lambda timeout because it's already sub 1 second
  const parseVerificationLambdaTimeout = Duration.minutes(1);
  const parseVerification: QueueAndLambdaSettings = {
    name: "SurescriptsParseVerification",
    entry: "surescripts-parse-verification",
    lambda: {
      memory: 1024,
      timeout: parseVerificationLambdaTimeout,
    },
    queue: {
      alarmMaxAgeOfOldestMessage: Duration.hours(1),
      maxMessageCountAlarmThreshold: 15_000,
      maxReceiveCount: 3,
      visibilityTimeout: Duration.seconds(parseVerificationLambdaTimeout.toSeconds() * 2 + 1),
      createRetryLambda: false,
    },
    eventSource: {
      batchSize: 1,
      reportBatchItemFailures: true,
      maxConcurrency: 4,
    },
    waitTime: waitTimeRefreshBundle,
  };

  // Skip adding the wait time to the lambda timeout because it's already sub 1 second
  const parseResponseLambdaTimeout = Duration.minutes(15);
  const parseResponse: QueueAndLambdaSettings = {
    name: "SurescriptsParseResponse",
    entry: "surescripts-parse-response",
    lambda: {
      memory: 1024,
      timeout: parseResponseLambdaTimeout,
    },
    queue: {
      alarmMaxAgeOfOldestMessage: Duration.hours(1),
      maxMessageCountAlarmThreshold: 15_000,
      maxReceiveCount: 3,
      visibilityTimeout: Duration.seconds(parseResponseLambdaTimeout.toSeconds() * 2 + 1),
      createRetryLambda: false,
    },
    eventSource: {
      batchSize: 1,
      reportBatchItemFailures: true,
      maxConcurrency: 4,
    },
    waitTime: waitTimeRefreshBundle,
  };

  return {
    synchronizeSftp,
    generateRequest,
    parseVerification,
    parseResponse,
  };
}

interface SurescriptsNestedStackProps extends NestedStackProps {
  config: EnvConfig;
  vpc: ec2.IVpc;
  alarmAction?: SnsAction;
  lambdaLayers: LambdaLayers;
  surescriptsBucket: s3.Bucket;
}

export class SurescriptsNestedStack extends NestedStack {
  readonly synchronizeSftpLambda: Lambda;
  readonly synchronizeSftpQueue: Queue;
  readonly generateRequestLambda: Lambda;
  readonly generateRequestQueue: Queue;
  readonly parseVerificationLambda: Lambda;
  readonly parseVerificationQueue: Queue;
  readonly parseResponseLambda: Lambda;
  readonly parseResponseQueue: Queue;
  readonly surescriptsBundleBucket: s3.Bucket;

  constructor(scope: Construct, id: string, props: SurescriptsNestedStackProps) {
    super(scope, id, props);

    this.terminationProtection = true;

    const surescriptsBundleBucket = new s3.Bucket(this, "SurescriptsBundleBucket", {
      bucketName: props.config.surescriptsBundleBucketName,
      publicReadAccess: false,
      encryption: s3.BucketEncryption.S3_MANAGED,
      versioned: true,
      cors: [
        {
          allowedOrigins: ["*"],
          allowedMethods: [s3.HttpMethods.GET],
        },
      ],
    });
    this.surescriptsBundleBucket = surescriptsBundleBucket;

    const synchronizeSftp = this.setupSynchronizeSftp({
      lambdaLayers: props.lambdaLayers,
      vpc: props.vpc,
      envType: props.config.environmentType,
      sentryDsn: props.config.lambdasSentryDSN,
      alarmAction: props.alarmAction,
      surescriptsBucket: props.surescriptsBucket,
    });
    this.synchronizeSftpLambda = synchronizeSftp.lambda;
    this.synchronizeSftpQueue = synchronizeSftp.queue;

    const generateRequest = this.setupGenerateRequest({
      lambdaLayers: props.lambdaLayers,
      vpc: props.vpc,
      envType: props.config.environmentType,
      sentryDsn: props.config.lambdasSentryDSN,
      alarmAction: props.alarmAction,
      surescriptsBucket: props.surescriptsBucket,
    });
    this.generateRequestLambda = generateRequest.lambda;
    this.generateRequestQueue = generateRequest.queue;

    const parseVerification = this.setupParseVerification({
      lambdaLayers: props.lambdaLayers,
      vpc: props.vpc,
      envType: props.config.environmentType,
      sentryDsn: props.config.lambdasSentryDSN,
      alarmAction: props.alarmAction,
      surescriptsBucket: props.surescriptsBucket,
    });
    this.parseVerificationLambda = parseVerification.lambda;
    this.parseVerificationQueue = parseVerification.queue;

    const parseResponse = this.setupParseResponse({
      lambdaLayers: props.lambdaLayers,
      vpc: props.vpc,
      envType: props.config.environmentType,
      sentryDsn: props.config.lambdasSentryDSN,
      alarmAction: props.alarmAction,
      surescriptsBucket: props.surescriptsBucket,
      surescriptsBundleBucket: this.surescriptsBundleBucket,
    });
    this.parseResponseLambda = parseResponse.lambda;
    this.parseResponseQueue = parseResponse.queue;
  }

  private setupSynchronizeSftp(ownProps: {
    lambdaLayers: LambdaLayers;
    vpc: ec2.IVpc;
    envType: EnvType;
    sentryDsn: string | undefined;
    alarmAction: SnsAction | undefined;
    surescriptsBucket: s3.Bucket;
  }): { lambda: Lambda; queue: Queue } {
    const { lambdaLayers, vpc, envType, sentryDsn, alarmAction } = ownProps;
    const {
      name,
      entry,
      lambda: lambdaSettings,
      queue: queueSettings,
      eventSource: eventSourceSettings,
      waitTime,
    } = settings().synchronizeSftp;

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
        ...(sentryDsn ? { SENTRY_DSN: sentryDsn } : {}),
      },
      layers: [lambdaLayers.shared],
      vpc,
      alarmSnsAction: alarmAction,
    });

    lambda.addEventSource(new SqsEventSource(queue, eventSourceSettings));

    return { lambda, queue };
  }

  private setupGenerateRequest(ownProps: {
    lambdaLayers: LambdaLayers;
    vpc: ec2.IVpc;
    envType: EnvType;
    sentryDsn: string | undefined;
    alarmAction: SnsAction | undefined;
    surescriptsBucket: s3.Bucket;
  }): { lambda: Lambda; queue: Queue } {
    const { lambdaLayers, vpc, envType, sentryDsn, alarmAction } = ownProps;
    const {
      name,
      entry,
      lambda: lambdaSettings,
      queue: queueSettings,
      eventSource: eventSourceSettings,
      waitTime,
    } = settings().generateRequest;

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
        ...(sentryDsn ? { SENTRY_DSN: sentryDsn } : {}),
      },
      layers: [lambdaLayers.shared],
      vpc,
      alarmSnsAction: alarmAction,
    });

    lambda.addEventSource(new SqsEventSource(queue, eventSourceSettings));

    return { lambda, queue };
  }

  private setupParseVerification(ownProps: {
    lambdaLayers: LambdaLayers;
    vpc: ec2.IVpc;
    envType: EnvType;
    sentryDsn: string | undefined;
    alarmAction: SnsAction | undefined;
    surescriptsBucket: s3.Bucket;
  }): { lambda: Lambda; queue: Queue } {
    const { lambdaLayers, vpc, envType, sentryDsn, alarmAction } = ownProps;
    const {
      name,
      entry,
      lambda: lambdaSettings,
      queue: queueSettings,
      eventSource: eventSourceSettings,
      waitTime,
    } = settings().parseVerification;

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
        ...(sentryDsn ? { SENTRY_DSN: sentryDsn } : {}),
      },
      layers: [lambdaLayers.shared],
      vpc,
      alarmSnsAction: alarmAction,
    });

    lambda.addEventSource(new SqsEventSource(queue, eventSourceSettings));

    return { lambda, queue };
  }

  private setupParseResponse(ownProps: {
    lambdaLayers: LambdaLayers;
    vpc: ec2.IVpc;
    envType: EnvType;
    sentryDsn: string | undefined;
    alarmAction: SnsAction | undefined;
    surescriptsBucket: s3.Bucket;
    surescriptsBundleBucket: s3.Bucket;
  }): { lambda: Lambda; queue: Queue } {
    const { lambdaLayers, vpc, envType, sentryDsn, alarmAction } = ownProps;
    const {
      name,
      entry,
      lambda: lambdaSettings,
      queue: queueSettings,
      eventSource: eventSourceSettings,
      waitTime,
    } = settings().parseResponse;

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
        SURESCRIPTS_BUCKET_NAME: ownProps.surescriptsBucket.bucketName,
        SURESCRIPTS_BUNDLE_BUCKET_NAME: ownProps.surescriptsBundleBucket.bucketName,
        WAIT_TIME_IN_MILLIS: waitTime.toMilliseconds().toString(),
        MAX_ATTEMPTS: queueSettings.maxReceiveCount.toString(),
        ...(sentryDsn ? { SENTRY_DSN: sentryDsn } : {}),
      },
      layers: [lambdaLayers.shared],
      vpc,
      alarmSnsAction: alarmAction,
    });

    lambda.addEventSource(new SqsEventSource(queue, eventSourceSettings));

    // Grant read to medical document bucket set on the api-stack
    ownProps.surescriptsBundleBucket.grantReadWrite(lambda);

    return { lambda, queue };
  }
}
