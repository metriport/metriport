import * as cdk from "aws-cdk-lib";
import { Duration, NestedStack, NestedStackProps } from "aws-cdk-lib";
import { SnsAction } from "aws-cdk-lib/aws-cloudwatch-actions";
import * as ec2 from "aws-cdk-lib/aws-ec2";
import * as iam from "aws-cdk-lib/aws-iam";
import * as lambda from "aws-cdk-lib/aws-lambda";
import { SqsEventSource } from "aws-cdk-lib/aws-lambda-event-sources";
import * as s3 from "aws-cdk-lib/aws-s3";
import { Queue } from "aws-cdk-lib/aws-sqs";
import { Construct } from "constructs";
import { EnvConfigNonSandbox } from "../../config/env-config";
import { EnvType } from "../env-type";
import { addErrorAlarmToLambdaFunc, createLambda } from "../shared/lambda";
import { LambdaLayers } from "../shared/lambda-layers";
import { LambdaSettingsWithNameAndEntry, QueueAndLambdaSettings } from "../shared/settings";
import { createQueue } from "../shared/sqs";
import { AnalyticsPlatformsAssets } from "./types";

const waitTimeFhirToCsv = Duration.seconds(0); // No limit

type DockerImageLambdaSettings = Omit<LambdaSettingsWithNameAndEntry, "entry">;

interface AnalyticsPlatformsSettings {
  fhirToCsv: QueueAndLambdaSettings;
  fhirToCsvTransform: DockerImageLambdaSettings;
  mergeCsvs: QueueAndLambdaSettings;
}

function settings(): AnalyticsPlatformsSettings {
  const fhirToCsvTransformLambdaTimeout = Duration.minutes(10);
  const fhirToCsvLambdaTimeout = fhirToCsvTransformLambdaTimeout.plus(Duration.seconds(10));
  const fhirToCsv: QueueAndLambdaSettings = {
    name: "FhirToCsv",
    entry: "analytics-platform/fhir-to-csv",
    lambda: {
      memory: 512,
      timeout: fhirToCsvLambdaTimeout,
    },
    queue: {
      alarmMaxAgeOfOldestMessage: Duration.hours(6),
      maxMessageCountAlarmThreshold: 5_000,
      maxReceiveCount: 1,
      visibilityTimeout: Duration.seconds(fhirToCsvLambdaTimeout.toSeconds() * 2 + 1),
      createRetryLambda: false,
    },
    eventSource: {
      batchSize: 1,
      reportBatchItemFailures: true,
      maxConcurrency: 5,
    },
    waitTime: waitTimeFhirToCsv,
  };
  const fhirToCsvTransform: DockerImageLambdaSettings = {
    name: "FhirToCsvTransform",
    lambda: {
      memory: 2048,
      timeout: fhirToCsvTransformLambdaTimeout,
      ephemeralStorageSize: cdk.Size.gibibytes(2),
    },
  };
  const mergeCsvsLambdaTimeout = Duration.minutes(15).minus(Duration.seconds(10));
  const mergeCsvs: QueueAndLambdaSettings = {
    name: "MergeCsvs",
    entry: "analytics-platform/merge-csvs",
    lambda: {
      memory: 4096,
      timeout: mergeCsvsLambdaTimeout,
    },
    queue: {
      alarmMaxAgeOfOldestMessage: Duration.hours(2),
      maxMessageCountAlarmThreshold: 1_000,
      maxReceiveCount: 1,
      visibilityTimeout: Duration.seconds(mergeCsvsLambdaTimeout.toSeconds() * 2 + 1),
      createRetryLambda: false,
    },
    eventSource: {
      batchSize: 1,
      reportBatchItemFailures: true,
      maxConcurrency: 20,
    },
    waitTime: waitTimeFhirToCsv,
  };
  return {
    fhirToCsv,
    fhirToCsvTransform,
    mergeCsvs,
  };
}

interface AnalyticsPlatformsNestedStackProps extends NestedStackProps {
  config: EnvConfigNonSandbox;
  vpc: ec2.IVpc;
  alarmAction?: SnsAction;
  lambdaLayers: LambdaLayers;
  medicalDocumentsBucket: s3.Bucket;
}

export class AnalyticsPlatformsNestedStack extends NestedStack {
  readonly fhirToCsvLambda: lambda.DockerImageFunction;
  readonly fhirToCsvQueue: Queue;
  readonly mergeCsvsLambda: lambda.DockerImageFunction;
  readonly mergeCsvsQueue: Queue;

  constructor(scope: Construct, id: string, props: AnalyticsPlatformsNestedStackProps) {
    super(scope, id, props);

    this.terminationProtection = true;

    // TODO ENG-858 reintroduce this
    // const snowflakeCreds = buildSecret(
    //   this,
    //   props.config.analyticsPlatform.secrets.SNOWFLAKE_CREDS
    // );

    const analyticsPlatformBucket = new s3.Bucket(this, "AnalyticsPlatformBucket", {
      bucketName: props.config.analyticsPlatform.bucketName,
      publicReadAccess: false,
      encryption: s3.BucketEncryption.S3_MANAGED,
      versioned: true,
    });

    // Snowflake access via S3 Integration https://docs.snowflake.com/en/user-guide/data-load-s3-config-storage-integration
    const snowflakePrefix = "snowflake";
    const s3Policy = new iam.Policy(this, "SnowflakeAnalyticsPlatformS3Policy", {
      policyName: `SnowflakeAnalyticsPlatformS3Policy-${props.config.environmentType}`,
      statements: [
        new iam.PolicyStatement({
          effect: iam.Effect.ALLOW,
          actions: [
            "s3:PutObject",
            "s3:GetObject",
            "s3:GetObjectVersion",
            "s3:DeleteObject",
            "s3:DeleteObjectVersion",
          ],
          resources: [analyticsPlatformBucket.bucketArn + "/" + snowflakePrefix + "/*"],
        }),
        new iam.PolicyStatement({
          effect: iam.Effect.ALLOW,
          actions: ["s3:ListBucket", "s3:GetBucketLocation"],
          resources: [analyticsPlatformBucket.bucketArn],
          conditions: {
            StringLike: {
              "s3:prefix": [`${snowflakePrefix}/*`],
            },
          },
        }),
      ],
    });
    new iam.Role(this, "SnowflakeIntegrationRole", {
      roleName: `SnowflakeIntegrationRole-${props.config.environmentType}`,
      assumedBy: new iam.ArnPrincipal(props.config.analyticsPlatform.snowflake.integrationUserArn),
      externalIds: [props.config.analyticsPlatform.snowflake.integrationExternalId],
      inlinePolicies: {
        SnowflakeAnalyticsPlatformS3Policy: s3Policy.document,
      },
    });

    const { fhirToCsvLambda, queue: fhirToCsvQueue } = this.setupFhirToCsvLambda({
      config: props.config,
      envType: props.config.environmentType,
      awsRegion: props.config.region,
      lambdaLayers: props.lambdaLayers,
      vpc: props.vpc,
      sentryDsn: props.config.sentryDSN,
      alarmAction: props.alarmAction,
      analyticsPlatformBucket,
      medicalDocumentsBucket: props.medicalDocumentsBucket,
    });
    this.fhirToCsvLambda = fhirToCsvLambda;
    this.fhirToCsvQueue = fhirToCsvQueue;

    const { mergeCsvsLambda, queue: mergeCsvsQueue } = this.setupMergeCsvsLambda({
      config: props.config,
      envType: props.config.environmentType,
      awsRegion: props.config.region,
      lambdaLayers: props.lambdaLayers,
      vpc: props.vpc,
      sentryDsn: props.config.sentryDSN,
      alarmAction: props.alarmAction,
      bucket: analyticsPlatformBucket,
    });
    this.mergeCsvsLambda = mergeCsvsLambda;
    this.mergeCsvsQueue = mergeCsvsQueue;
  }

  getAssets(): AnalyticsPlatformsAssets {
    return {
      fhirToCsvLambda: this.fhirToCsvLambda,
      fhirToCsvQueue: this.fhirToCsvQueue,
      mergeCsvsLambda: this.mergeCsvsLambda,
      mergeCsvsQueue: this.mergeCsvsQueue,
    };
  }

  private setupFhirToCsvLambda(ownProps: {
    config: EnvConfigNonSandbox;
    envType: EnvType;
    awsRegion: string;
    lambdaLayers: LambdaLayers;
    vpc: ec2.IVpc;
    sentryDsn: string | undefined;
    alarmAction: SnsAction | undefined;
    analyticsPlatformBucket: s3.Bucket;
    medicalDocumentsBucket: s3.Bucket;
  }): {
    fhirToCsvLambda: lambda.DockerImageFunction;
    queue: Queue;
  } {
    const { lambda: fhirToCsvTransformLambdaSettings, name: fhirToCsvTransformLambdaName } =
      settings().fhirToCsvTransform;

    // TODO Try to make this lambda to read from and write to SQS, then we don't need the FhirToCsv one
    const fhirToCsvTransformLambda = new lambda.DockerImageFunction(
      this,
      "FhirToCsvTransformLambda",
      {
        functionName: fhirToCsvTransformLambdaName,
        vpc: ownProps.vpc,
        code: lambda.DockerImageCode.fromImageAsset("../data-transformation/fhir-to-csv", {
          file: "Dockerfile.lambda",
        }),
        timeout: fhirToCsvTransformLambdaSettings.timeout,
        memorySize: fhirToCsvTransformLambdaSettings.memory,
        ephemeralStorageSize: fhirToCsvTransformLambdaSettings.ephemeralStorageSize,
        environment: {
          ENV: ownProps.envType,
          INPUT_S3_BUCKET: ownProps.medicalDocumentsBucket.bucketName,
          OUTPUT_S3_BUCKET: ownProps.analyticsPlatformBucket.bucketName,
        },
      }
    );

    addErrorAlarmToLambdaFunc(
      this,
      fhirToCsvTransformLambda,
      `${fhirToCsvTransformLambdaName}-GeneralLambdaAlarm`,
      ownProps.alarmAction
    );

    // Grant read to medical document bucket set on the api-stack
    ownProps.analyticsPlatformBucket.grantReadWrite(fhirToCsvTransformLambda);

    const { lambdaLayers, vpc, envType, sentryDsn, alarmAction } = ownProps;

    const {
      name,
      entry,
      lambda: fhirToCsvLambdaSettings,
      queue: queueSettings,
      eventSource: eventSourceSettings,
      waitTime,
    } = settings().fhirToCsv;

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

    const fhirToCsvLambda = createLambda({
      ...fhirToCsvLambdaSettings,
      stack: this,
      name,
      entry,
      envType,
      envVars: {
        // API_URL set on the api-stack after the OSS API is created
        WAIT_TIME_IN_MILLIS: waitTime.toMilliseconds().toString(),
        FHIR_TO_CSV_TRANSFORM_LAMBDA_NAME: fhirToCsvTransformLambda.functionName,
        ...(sentryDsn ? { SENTRY_DSN: sentryDsn } : {}),
      },
      layers: [lambdaLayers.shared],
      vpc,
      alarmSnsAction: alarmAction,
    });

    fhirToCsvLambda.addEventSource(new SqsEventSource(queue, eventSourceSettings));
    fhirToCsvTransformLambda.grantInvoke(fhirToCsvLambda);
    ownProps.medicalDocumentsBucket.grantRead(fhirToCsvTransformLambda);

    return { fhirToCsvLambda, queue };
  }

  private setupMergeCsvsLambda(ownProps: {
    config: EnvConfigNonSandbox;
    envType: EnvType;
    awsRegion: string;
    lambdaLayers: LambdaLayers;
    vpc: ec2.IVpc;
    sentryDsn: string | undefined;
    alarmAction: SnsAction | undefined;
    bucket: s3.Bucket;
  }): {
    mergeCsvsLambda: lambda.DockerImageFunction;
    queue: Queue;
  } {
    const { lambdaLayers, vpc, envType, sentryDsn, alarmAction } = ownProps;
    const {
      name,
      entry,
      lambda: lambdaSettings,
      queue: queueSettings,
      eventSource: eventSourceSettings,
      waitTime,
    } = settings().mergeCsvs;

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

    const mergeCsvsLambda = createLambda({
      ...lambdaSettings,
      stack: this,
      name,
      entry,
      envType,
      envVars: {
        // API_URL set on the api-stack after the OSS API is created
        WAIT_TIME_IN_MILLIS: waitTime.toMilliseconds().toString(),
        ANALYTICS_BUCKET_NAME: ownProps.bucket.bucketName,
        ...(sentryDsn ? { SENTRY_DSN: sentryDsn } : {}),
      },
      layers: [lambdaLayers.shared],
      vpc,
      alarmSnsAction: alarmAction,
    });

    mergeCsvsLambda.addEventSource(new SqsEventSource(queue, eventSourceSettings));
    ownProps.bucket.grantReadWrite(mergeCsvsLambda);

    return { mergeCsvsLambda, queue };
  }
}
