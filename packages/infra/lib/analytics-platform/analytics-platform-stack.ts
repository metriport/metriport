import { DatabaseCredsForLambda } from "@metriport/core/command/analytics-platform/config";
import * as cdk from "aws-cdk-lib";
import { Aspects, Duration, NestedStack, NestedStackProps, RemovalPolicy } from "aws-cdk-lib";
import * as batch from "aws-cdk-lib/aws-batch";
import { SnsAction } from "aws-cdk-lib/aws-cloudwatch-actions";
import * as dynamodb from "aws-cdk-lib/aws-dynamodb";
import * as ec2 from "aws-cdk-lib/aws-ec2";
import { DockerImageAsset } from "aws-cdk-lib/aws-ecr-assets";
import * as ecs from "aws-cdk-lib/aws-ecs";
import * as events from "aws-cdk-lib/aws-events";
import * as targets from "aws-cdk-lib/aws-events-targets";
import * as iam from "aws-cdk-lib/aws-iam";
import * as lambda from "aws-cdk-lib/aws-lambda";
import {
  SnsEventSource,
  SnsEventSourceProps,
  SqsEventSource,
} from "aws-cdk-lib/aws-lambda-event-sources";
import * as rds from "aws-cdk-lib/aws-rds";
import * as s3 from "aws-cdk-lib/aws-s3";
import * as secret from "aws-cdk-lib/aws-secretsmanager";
import * as sns from "aws-cdk-lib/aws-sns";
import { Queue } from "aws-cdk-lib/aws-sqs";
import { Construct } from "constructs";
import { EnvConfigNonSandbox } from "../../config/env-config";
import { EnvType } from "../env-type";
import { addErrorAlarmToLambdaFunc, createLambda } from "../shared/lambda";
import { LambdaLayers } from "../shared/lambda-layers";
import { createScheduledLambda } from "../shared/lambda-scheduled";
import { addDBClusterPerformanceAlarms } from "../shared/rds";
import { buildSecret } from "../shared/secrets";
import {
  LambdaSettingsWithNameAndEntry,
  LambdaSetup,
  QueueAndLambdaSettings,
} from "../shared/settings";
import { createQueue } from "../shared/sqs";
import { isProdEnv } from "../shared/util";
import { AnalyticsPlatformsAssets } from "./types";

type DockerImageLambdaSettings = Omit<LambdaSettingsWithNameAndEntry, "entry">;
type BatchJobSettings = {
  memory: cdk.Size;
  cpu: number;
};

type CoreToS3LambdaSettings = LambdaSetup & {
  eventSource: SnsEventSourceProps;
};

interface AnalyticsPlatformsSettings {
  fhirToCsvBulk: QueueAndLambdaSettings;
  fhirToCsvIncremental: QueueAndLambdaSettings;
  fhirToCsvTransform: DockerImageLambdaSettings;
  mergeCsvs: QueueAndLambdaSettings;
  coreTransform: BatchJobSettings;
  coreTransformScheduled: {
    name: string;
    lambda: {
      memory: number;
      timeout: Duration;
    };
    url: string;
    scheduleExpression: string;
  };
  coreToS3Lambda: CoreToS3LambdaSettings;
}

function settings(envType: EnvType): AnalyticsPlatformsSettings {
  const fhirToCsvTransformLambdaTimeout = Duration.minutes(10);
  const fhirToCsvBulkLambdaTimeout = fhirToCsvTransformLambdaTimeout.plus(Duration.seconds(10));
  const fhirToCsvIncrementalLambdaTimeout = fhirToCsvTransformLambdaTimeout.plus(
    Duration.seconds(10)
  );
  const coreTransformScheduledLambdaInterval = Duration.minutes(20);
  const coreTransformConnectorLambdaTimeout = Duration.minutes(15).minus(Duration.seconds(2));

  const fhirToCsvBulk: QueueAndLambdaSettings = {
    name: "FhirToCsvBulk",
    entry: "analytics-platform/fhir-to-csv-bulk",
    lambda: {
      memory: 512,
      timeout: fhirToCsvBulkLambdaTimeout,
    },
    queue: {
      alarmMaxAgeOfOldestMessage: Duration.hours(6),
      maxMessageCountAlarmThreshold: 5_000,
      maxReceiveCount: 1,
      visibilityTimeout: Duration.seconds(fhirToCsvBulkLambdaTimeout.toSeconds() * 2 + 1),
      createRetryLambda: false,
    },
    eventSource: {
      batchSize: 1,
      reportBatchItemFailures: true,
      maxConcurrency: 100,
    },
    waitTime: Duration.seconds(0),
  };
  const fhirToCsvIncremental: QueueAndLambdaSettings = {
    name: "FhirToCsvIncremental",
    entry: "analytics-platform/fhir-to-csv-incremental",
    lambda: {
      memory: 512,
      timeout: fhirToCsvIncrementalLambdaTimeout,
    },
    queue: {
      alarmMaxAgeOfOldestMessage: Duration.hours(6),
      maxMessageCountAlarmThreshold: 5_000,
      maxReceiveCount: 3,
      visibilityTimeout: Duration.seconds(fhirToCsvIncrementalLambdaTimeout.toSeconds()),
      createRetryLambda: false,
      deliveryDelay: isProdEnv(envType) ? Duration.minutes(5) : Duration.seconds(30),
    },
    eventSource: {
      batchSize: 1,
      reportBatchItemFailures: true,
      maxConcurrency: 20,
    },
    waitTime: Duration.seconds(0),
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
    waitTime: Duration.seconds(0),
  };
  const coreTransform: BatchJobSettings = {
    memory: cdk.Size.mebibytes(8192),
    cpu: 4,
  };
  const coreTransformScheduled = {
    name: "CoreTransformScheduled",
    lambda: {
      memory: 512,
      timeout: Duration.minutes(1),
    },
    url: `/internal/analytics-platform/ingestion/core/rebuild`,
    scheduleExpression: `0/${coreTransformScheduledLambdaInterval.toMinutes()} * * * ? *`,
  };
  const coreToS3Lambda: CoreToS3LambdaSettings = {
    name: "CoreToS3",
    lambda: {
      memory: 1024,
      entry: "analytics-platform/core-to-s3",
      timeout: coreTransformConnectorLambdaTimeout,
      runtime: lambda.Runtime.NODEJS_20_X,
    },
    eventSource: {},
  };
  return {
    fhirToCsvBulk,
    fhirToCsvIncremental,
    fhirToCsvTransform,
    mergeCsvs,
    coreTransform,
    coreTransformScheduled,
    coreToS3Lambda,
  };
}

interface AnalyticsPlatformsNestedStackProps extends NestedStackProps {
  config: EnvConfigNonSandbox;
  vpc: ec2.IVpc;
  alarmAction?: SnsAction;
  lambdaLayers: LambdaLayers;
  medicalDocumentsBucket: s3.Bucket;
  featureFlagsTable: dynamodb.Table;
}

export class AnalyticsPlatformsNestedStack extends NestedStack {
  readonly fhirToCsvBulkLambda: lambda.Function;
  readonly fhirToCsvBulkQueue: Queue;
  readonly fhirToCsvIncrementalLambda: lambda.Function;
  readonly fhirToCsvIncrementalQueue: Queue;
  readonly mergeCsvsLambda: lambda.Function;
  readonly mergeCsvsQueue: Queue;
  readonly coreTransformBatchJob: batch.EcsJobDefinition;
  readonly coreTransformBatchJobContainer: batch.EcsFargateContainerDefinition;
  readonly coreTransformBatchJobQueue: batch.JobQueue;
  readonly analyticsPlatformBucket: s3.Bucket;
  readonly coreTransformJobCompletionTopic: sns.Topic;
  readonly coreTransformScheduledLambda: lambda.Function;
  readonly coreToS3Lambda: lambda.Function;
  readonly dbCredsSecret: secret.Secret;

  constructor(scope: Construct, id: string, props: AnalyticsPlatformsNestedStackProps) {
    super(scope, id, props);

    this.terminationProtection = true;

    const analyticsPlatformBucket = new s3.Bucket(this, "AnalyticsPlatformBucket", {
      bucketName: props.config.analyticsPlatform.bucketName,
      publicReadAccess: false,
      encryption: s3.BucketEncryption.S3_MANAGED,
      versioned: true,
    });
    this.analyticsPlatformBucket = analyticsPlatformBucket;
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

    const { dbCluster, dbCredsSecret } = this.setupDB({
      config: props.config,
      envType: props.config.environmentType,
      awsRegion: props.config.region,
      vpc: props.vpc,
      analyticsBucket: analyticsPlatformBucket,
      alarmAction: props.alarmAction,
      analyticsBucket: analyticsPlatformBucket,
    });
    this.dbCredsSecret = dbCredsSecret;

    const dbUserSecret = buildSecret(
      this,
      props.config.analyticsPlatform.secretNames.FHIR_TO_CSV_DB_PASSWORD
    );

    const analyticsPlatformComputeEnvironment = new batch.FargateComputeEnvironment(
      this,
      "AnalyticsPlatformComputeEnvironment",
      {
        vpc: props.vpc,
      }
    );

    dbCluster.connections.allowDefaultPortFrom(analyticsPlatformComputeEnvironment);

    const { fhirToCsvTransformLambda } = this.setupFhirToCsvTransformLambda({
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

    const { lambda: fhirToCsvBulkLambda, queue: fhirToCsvBulkQueue } =
      this.setupFhirToCsvBulkLambda({
        config: props.config,
        envType: props.config.environmentType,
        awsRegion: props.config.region,
        lambdaLayers: props.lambdaLayers,
        vpc: props.vpc,
        sentryDsn: props.config.sentryDSN,
        alarmAction: props.alarmAction,
        fhirToCsvTransformLambda,
        featureFlagsTable: props.featureFlagsTable,
        medicalDocumentsBucket: props.medicalDocumentsBucket,
      });
    this.fhirToCsvBulkLambda = fhirToCsvBulkLambda;
    this.fhirToCsvBulkQueue = fhirToCsvBulkQueue;

    const { lambda: fhirToCsvIncrementalLambda, queue: fhirToCsvIncrementalQueue } =
      this.setupFhirToCsvIncrementalLambda({
        config: props.config,
        envType: props.config.environmentType,
        awsRegion: props.config.region,
        lambdaLayers: props.lambdaLayers,
        vpc: props.vpc,
        sentryDsn: props.config.sentryDSN,
        alarmAction: props.alarmAction,
        analyticsPlatformBucket,
        fhirToCsvTransformLambda,
        featureFlagsTable: props.featureFlagsTable,
        medicalDocumentsBucket: props.medicalDocumentsBucket,
        dbCluster,
        dbUserSecret,
      });
    this.fhirToCsvIncrementalLambda = fhirToCsvIncrementalLambda;
    this.fhirToCsvIncrementalQueue = fhirToCsvIncrementalQueue;

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

    const {
      queue: coreTransformBatchJobQueue,
      container: coreTransformBatchJobContainer,
      job: coreTransformBatchJob,
    } = this.setupCoreTransformBatchJob({
      config: props.config,
      envType: props.config.environmentType,
      awsRegion: props.config.region,
      lambdaLayers: props.lambdaLayers,
      vpc: props.vpc,
      sentryDsn: props.config.sentryDSN,
      alarmAction: props.alarmAction,
      dbCluster,
      dbCredsSecret,
      computeEnvironment: analyticsPlatformComputeEnvironment,
    });
    this.coreTransformBatchJob = coreTransformBatchJob;
    this.coreTransformBatchJobContainer = coreTransformBatchJobContainer;
    this.coreTransformBatchJobQueue = coreTransformBatchJobQueue;

    const { topic: coreTransformJobCompletionTopic } = this.setupCoreTransformJobCompletion({
      config: props.config,
      envType: props.config.environmentType,
      awsRegion: props.config.region,
      coreTransformBatchJob,
    });
    this.coreTransformJobCompletionTopic = coreTransformJobCompletionTopic;

    this.coreTransformScheduledLambda = this.setupCoreTransformerScheduleLambda({
      config: props.config,
      envType: props.config.environmentType,
      awsRegion: props.config.region,
      lambdaLayers: props.lambdaLayers,
      vpc: props.vpc,
    });

    this.coreToS3Lambda = this.setupCoreToS3Lambda({
      config: props.config,
      envType: props.config.environmentType,
      awsRegion: props.config.region,
      lambdaLayers: props.lambdaLayers,
      vpc: props.vpc,
      sentryDsn: props.config.sentryDSN,
      alarmAction: props.alarmAction,
      analyticsPlatformBucket,
      featureFlagsTable: props.featureFlagsTable,
      medicalDocumentsBucket: props.medicalDocumentsBucket,
      dbCluster,
      dbCredsSecret,
      coreTransformJobCompletionTopic,
    });

    // TODO ENG-858 reintroduce this
    // const snowflakeCreds = buildSecret(
    //   this,
    //   props.config.analyticsPlatform.secrets.SNOWFLAKE_CREDS
    // );
  }

  getAssets(): AnalyticsPlatformsAssets {
    return {
      fhirToCsvBulkLambda: this.fhirToCsvBulkLambda,
      fhirToCsvBulkQueue: this.fhirToCsvBulkQueue,
      fhirToCsvIncrementalLambda: this.fhirToCsvIncrementalLambda,
      fhirToCsvIncrementalQueue: this.fhirToCsvIncrementalQueue,
      mergeCsvsLambda: this.mergeCsvsLambda,
      mergeCsvsQueue: this.mergeCsvsQueue,
      coreTransformBatchJob: this.coreTransformBatchJob,
      coreTransformBatchJobQueue: this.coreTransformBatchJobQueue,
      coreTransformBatchJobContainer: this.coreTransformBatchJobContainer,
      analyticsPlatformBucket: this.analyticsPlatformBucket,
      coreTransformJobCompletionTopic: this.coreTransformJobCompletionTopic,
      coreTransformScheduledLambda: this.coreTransformScheduledLambda,
      dbCredsSecret: this.dbCredsSecret,
    };
  }

  private setupDB(ownProps: {
    config: EnvConfigNonSandbox;
    envType: EnvType;
    awsRegion: string;
    vpc: ec2.IVpc;
    analyticsBucket: s3.Bucket;
    alarmAction: SnsAction | undefined;
  }): {
    dbCluster: rds.DatabaseCluster;
    dbCredsSecret: secret.Secret;
  } {
    const dbConfig = ownProps.config.analyticsPlatform.rds;
    // create database credentials
    const dbSecretName = "AnalyticsDbCreds";
    const dbCredsSecret = new secret.Secret(this, dbSecretName, {
      secretName: dbSecretName,
      generateSecretString: {
        secretStringTemplate: JSON.stringify({
          username: dbConfig.username,
        }),
        excludePunctuation: true,
        includeSpace: false,
        generateStringKey: "password",
      },
    });
    const dbCreds = rds.Credentials.fromSecret(dbCredsSecret);
    const dbEngine = rds.DatabaseClusterEngine.auroraPostgres({
      version: rds.AuroraPostgresEngineVersion.VER_16_1,
    });
    const parameterGroup = new rds.ParameterGroup(this, "AnalyticsDbParams", {
      engine: dbEngine,
      parameters: {
        ...(dbConfig.minSlowLogDurationInMs
          ? {
              log_min_duration_statement: dbConfig.minSlowLogDurationInMs.toString(),
            }
          : undefined),
      },
    });

    const dbClusterS3Role = new iam.Role(this, "DatabaseClusterS3Role", {
      roleName: `DatabaseClusterS3Role2-${ownProps.envType}`,
      assumedBy: new iam.ServicePrincipal("rds.amazonaws.com"),
      inlinePolicies: {
        S3AccessPolicy: new iam.PolicyDocument({
          statements: [
            new iam.PolicyStatement({
              effect: iam.Effect.ALLOW,
              actions: [
                "s3:PutObject",
                "s3:GetObject",
                "s3:GetObjectVersion",
                "s3:DeleteObject",
                "s3:DeleteObjectVersion",
                "s3:AbortMultipartUpload",
                "s3:ListMultipartUploadParts",
              ],
              resources: [`arn:aws:s3:::${ownProps.analyticsBucket.bucketName}/*`],
            }),
            new iam.PolicyStatement({
              effect: iam.Effect.ALLOW,
              actions: ["s3:ListBucket", "s3:GetBucketLocation", "s3:ListBucketMultipartUploads"],
              resources: [`arn:aws:s3:::${ownProps.analyticsBucket.bucketName}`],
            }),
          ],
        }),
      },
    });

    const dbClusterName = "analytics-cluster";
    const dbCluster = new rds.DatabaseCluster(this, "AnalyticsDbCluster", {
      engine: dbEngine,
      writer: rds.ClusterInstance.serverlessV2("writer", {
        enablePerformanceInsights: true,
        parameterGroup,
      }),
      readers: [
        rds.ClusterInstance.serverlessV2("reader", {
          enablePerformanceInsights: true,
          parameterGroup,
        }),
      ],
      vpc: ownProps.vpc,
      preferredMaintenanceWindow: dbConfig.maintenanceWindow,
      credentials: dbCreds,
      defaultDatabaseName: dbConfig.name,
      clusterIdentifier: dbClusterName,
      storageEncrypted: true,
      parameterGroup,
      cloudwatchLogsExports: ["postgresql"],
      deletionProtection: true,
      removalPolicy: RemovalPolicy.RETAIN,
    });
    Aspects.of(dbCluster).add({
      visit(node) {
        if (node instanceof rds.CfnDBCluster) {
          node.serverlessV2ScalingConfiguration = {
            minCapacity: dbConfig.minCapacity,
            maxCapacity: dbConfig.maxCapacity,
          };
        }
      },
    });

    const cfnDbCluster = dbCluster.node.defaultChild as rds.CfnDBCluster;
    cfnDbCluster.associatedRoles = [
      {
        roleArn: dbClusterS3Role.roleArn,
        featureName: "s3Export",
      },
      {
        roleArn: dbClusterS3Role.roleArn,
        featureName: "s3Import",
      },
    ];

    addDBClusterPerformanceAlarms(this, dbCluster, dbClusterName, dbConfig, ownProps.alarmAction);

    return { dbCluster, dbCredsSecret };
  }

  private setupFhirToCsvTransformLambda(ownProps: {
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
    fhirToCsvTransformLambda: lambda.DockerImageFunction;
  } {
    const { lambda: fhirToCsvTransformLambdaSettings, name: fhirToCsvTransformLambdaName } =
      settings(ownProps.envType).fhirToCsvTransform;

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

    ownProps.analyticsPlatformBucket.grantReadWrite(fhirToCsvTransformLambda);
    ownProps.medicalDocumentsBucket.grantRead(fhirToCsvTransformLambda);

    return { fhirToCsvTransformLambda };
  }

  private setupFhirToCsvBulkLambda(ownProps: {
    config: EnvConfigNonSandbox;
    envType: EnvType;
    awsRegion: string;
    lambdaLayers: LambdaLayers;
    vpc: ec2.IVpc;
    sentryDsn: string | undefined;
    alarmAction: SnsAction | undefined;
    fhirToCsvTransformLambda: lambda.DockerImageFunction;
    featureFlagsTable: dynamodb.Table;
    medicalDocumentsBucket: s3.Bucket;
  }): {
    lambda: lambda.Function;
    queue: Queue;
  } {
    const {
      lambdaLayers,
      vpc,
      envType,
      sentryDsn,
      alarmAction,
      fhirToCsvTransformLambda,
      featureFlagsTable,
    } = ownProps;

    const {
      name,
      entry,
      lambda: lambdaSettings,
      queue: queueSettings,
      eventSource: eventSourceSettings,
      waitTime,
    } = settings(envType).fhirToCsvBulk;

    const queue = createQueue({
      ...queueSettings,
      stack: this,
      name,
      fifo: true,
      createDLQ: true,
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
        FHIR_TO_CSV_TRANSFORM_LAMBDA_NAME: fhirToCsvTransformLambda.functionName,
        FEATURE_FLAGS_TABLE_NAME: featureFlagsTable.tableName,
        MEDICAL_DOCUMENTS_BUCKET_NAME: ownProps.medicalDocumentsBucket.bucketName,
        ...(sentryDsn ? { SENTRY_DSN: sentryDsn } : {}),
      },
      layers: [lambdaLayers.shared, lambdaLayers.langchain],
      vpc,
      alarmSnsAction: alarmAction,
    });

    lambda.addEventSource(new SqsEventSource(queue, eventSourceSettings));

    fhirToCsvTransformLambda.grantInvoke(lambda);
    featureFlagsTable.grantReadData(lambda);
    ownProps.medicalDocumentsBucket.grantRead(lambda);

    return { lambda, queue };
  }

  private setupFhirToCsvIncrementalLambda(ownProps: {
    config: EnvConfigNonSandbox;
    envType: EnvType;
    awsRegion: string;
    lambdaLayers: LambdaLayers;
    vpc: ec2.IVpc;
    sentryDsn: string | undefined;
    alarmAction: SnsAction | undefined;
    analyticsPlatformBucket: s3.Bucket;
    fhirToCsvTransformLambda: lambda.DockerImageFunction;
    featureFlagsTable: dynamodb.Table;
    medicalDocumentsBucket: s3.Bucket;
    dbCluster: rds.DatabaseCluster;
    dbUserSecret: secret.ISecret;
  }): {
    lambda: lambda.Function;
    queue: Queue;
  } {
    const {
      lambdaLayers,
      vpc,
      envType,
      sentryDsn,
      alarmAction,
      fhirToCsvTransformLambda,
      analyticsPlatformBucket,
      featureFlagsTable,
      dbCluster,
      config,
      dbUserSecret,
    } = ownProps;

    const {
      name,
      entry,
      lambda: lambdaSettings,
      queue: queueSettings,
      eventSource: eventSourceSettings,
      waitTime,
    } = settings(envType).fhirToCsvIncremental;

    const queue = createQueue({
      ...queueSettings,
      stack: this,
      name,
      fifo: true,
      createDLQ: true,
      envType,
      alarmSnsAction: alarmAction,
      deliveryDelay: queueSettings.deliveryDelay,
    });

    const dbCreds: DatabaseCredsForLambda = {
      host: ownProps.dbCluster.clusterEndpoint.hostname,
      port: ownProps.dbCluster.clusterEndpoint.port,
      engine: "postgres" as const,
      dbname: config.analyticsPlatform.rds.name,
      username: config.analyticsPlatform.rds.fhirToCsvDbUsername,
      passwordSecretArn: dbUserSecret.secretArn,
    };

    const lambda = createLambda({
      ...lambdaSettings,
      stack: this,
      name,
      entry,
      envType,
      envVars: {
        // API_URL set on the api-stack after the OSS API is created
        WAIT_TIME_IN_MILLIS: waitTime.toMilliseconds().toString(),
        FHIR_TO_CSV_TRANSFORM_LAMBDA_NAME: fhirToCsvTransformLambda.functionName,
        ANALYTICS_BUCKET_NAME: analyticsPlatformBucket.bucketName,
        FEATURE_FLAGS_TABLE_NAME: featureFlagsTable.tableName,
        MEDICAL_DOCUMENTS_BUCKET_NAME: ownProps.medicalDocumentsBucket.bucketName,
        DB_CREDS: JSON.stringify(dbCreds),
        ...(sentryDsn ? { SENTRY_DSN: sentryDsn } : {}),
      },
      layers: [lambdaLayers.shared, lambdaLayers.langchain, lambdaLayers.analyticsPlatform],
      vpc,
      alarmSnsAction: alarmAction,
    });

    lambda.addEventSource(new SqsEventSource(queue, eventSourceSettings));

    dbCluster.connections.allowDefaultPortFrom(lambda);
    fhirToCsvTransformLambda.grantInvoke(lambda);
    analyticsPlatformBucket.grantReadWrite(lambda);
    ownProps.medicalDocumentsBucket.grantRead(lambda);
    featureFlagsTable.grantReadData(lambda);
    dbUserSecret.grantRead(lambda);

    return { lambda, queue };
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
    mergeCsvsLambda: lambda.Function;
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
    } = settings(envType).mergeCsvs;

    const queue = createQueue({
      ...queueSettings,
      stack: this,
      name,
      fifo: true,
      createDLQ: true,
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

  private setupCoreTransformBatchJob(ownProps: {
    config: EnvConfigNonSandbox;
    envType: EnvType;
    awsRegion: string;
    lambdaLayers: LambdaLayers;
    vpc: ec2.IVpc;
    sentryDsn: string | undefined;
    alarmAction: SnsAction | undefined;
    dbCluster: rds.DatabaseCluster;
    dbCredsSecret: secret.Secret;
    computeEnvironment: batch.FargateComputeEnvironment;
  }): {
    job: batch.EcsJobDefinition;
    container: batch.EcsFargateContainerDefinition;
    queue: batch.JobQueue;
  } {
    const { memory, cpu } = settings(ownProps.envType).coreTransform;

    const asset = new DockerImageAsset(this, "CoreTransformBuildImage", {
      directory: "../data-transformation/raw-to-core",
      file: "Dockerfile",
    });

    const container = new batch.EcsFargateContainerDefinition(this, "CoreTransformContainerDef", {
      image: ecs.ContainerImage.fromDockerImageAsset(asset),
      memory,
      cpu,
      environment: {
        ENV: ownProps.envType,
        AWS_REGION: ownProps.awsRegion,
        HOST: ownProps.dbCluster.clusterEndpoint.hostname,
        USER: ownProps.config.analyticsPlatform.rds.fhirToCsvDbUsername,
      },
      secrets: {
        PASSWORD: ecs.Secret.fromSecretsManager(ownProps.dbCredsSecret),
      },
      command: ["python", "main.py", "Ref::database", "Ref::schema"],
    });

    const job = new batch.EcsJobDefinition(this, "CoreTransformBatchJob", {
      jobDefinitionName: "CoreTransformBatchJob",
      container,
      parameters: {
        database: "default",
        schema: "default",
      },
    });

    const queue = new batch.JobQueue(this, "CoreTransformJobQueue", {
      computeEnvironments: [
        {
          computeEnvironment: ownProps.computeEnvironment,
          order: 1,
        },
      ],
      priority: 10,
    });

    ownProps.dbUserSecret.grantRead(container.executionRole);

    return { job, container, queue };
  }

  private setupCoreTransformJobCompletion(ownProps: {
    config: EnvConfigNonSandbox;
    envType: EnvType;
    awsRegion: string;
    coreTransformBatchJob: batch.EcsJobDefinition;
  }): {
    topic: sns.Topic;
  } {
    const { envType, coreTransformBatchJob } = ownProps;

    const topic = new sns.Topic(this, "CoreTransformJobCompletionTopic", {
      topicName: `core-transform-job-completion-${envType}`,
      displayName: "Core Transform Job Completion",
    });

    const eventRule = new events.Rule(this, "CoreTransformJobStateChangeRule", {
      ruleName: `core-transform-job-state-change-${envType}`,
      description: "Rule to capture Core Transform batch job state changes",
      eventPattern: {
        source: ["aws.batch"],
        detailType: ["Batch Job State Change"],
        detail: {
          jobDefinition: [coreTransformBatchJob.jobDefinitionArn],
          status: ["SUCCEEDED", "FAILED"],
        },
      },
    });

    // Add SNS target to EventBridge rule
    eventRule.addTarget(
      new targets.SnsTopic(topic, {
        message: events.RuleTargetInput.fromObject({
          jobId: events.EventField.fromPath("$.detail.jobId"),
          jobName: events.EventField.fromPath("$.detail.jobName"),
          jobStatus: events.EventField.fromPath("$.detail.status"),
          jobDefinition: events.EventField.fromPath("$.detail.jobDefinition"),
          jobQueue: events.EventField.fromPath("$.detail.jobQueue"),
          startedAt: events.EventField.fromPath("$.detail.startedAt"),
          stoppedAt: events.EventField.fromPath("$.detail.stoppedAt"),
          timestamp: events.EventField.fromPath("$.time"),
        }),
      })
    );

    // Grant EventBridge permission to publish to SNS topic
    topic.grantPublish(new iam.ServicePrincipal("events.amazonaws.com"));

    return { topic };
  }

  private setupCoreTransformerScheduleLambda(ownProps: {
    config: EnvConfigNonSandbox;
    envType: EnvType;
    awsRegion: string;
    lambdaLayers: LambdaLayers;
    vpc: ec2.IVpc;
  }): lambda.Function {
    const { lambdaLayers, vpc } = ownProps;

    const {
      name,
      lambda: { timeout, memory },
      scheduleExpression,
      url,
    } = settings(ownProps.envType).coreTransformScheduled;

    const lambda = createScheduledLambda({
      stack: this,
      layers: [lambdaLayers.shared],
      name,
      vpc,
      memory,
      scheduleExpression,
      url,
      timeout,
      envType: ownProps.config.environmentType,
      envVars: {
        ...(ownProps.config.lambdasSentryDSN
          ? { SENTRY_DSN: ownProps.config.lambdasSentryDSN }
          : {}),
      },
    });

    return lambda;
  }

  private setupCoreToS3Lambda(ownProps: {
    config: EnvConfigNonSandbox;
    envType: EnvType;
    awsRegion: string;
    lambdaLayers: LambdaLayers;
    vpc: ec2.IVpc;
    sentryDsn: string | undefined;
    alarmAction: SnsAction | undefined;
    analyticsPlatformBucket: s3.Bucket;
    featureFlagsTable: dynamodb.Table;
    medicalDocumentsBucket: s3.Bucket;
    dbCluster: rds.DatabaseCluster;
    dbCredsSecret: secret.Secret;
    coreTransformJobCompletionTopic: sns.Topic;
  }): lambda.Function {
    const {
      lambdaLayers,
      vpc,
      envType,
      sentryDsn,
      alarmAction,
      analyticsPlatformBucket,
      featureFlagsTable,
      dbCluster,
      dbCredsSecret,
      coreTransformJobCompletionTopic,
    } = ownProps;

    const { name, lambda: lambdaSettings, eventSource } = settings(envType).coreToS3Lambda;

    const lambda = createLambda({
      ...lambdaSettings,
      stack: this,
      name,
      entry: lambdaSettings.entry,
      envType,
      envVars: {
        ANALYTICS_BUCKET_NAME: analyticsPlatformBucket.bucketName,
        FEATURE_FLAGS_TABLE_NAME: featureFlagsTable.tableName,
        DB_CREDS_ARN: dbCredsSecret.secretArn,
        ...(sentryDsn ? { SENTRY_DSN: sentryDsn } : {}),
      },
      layers: [lambdaLayers.shared, lambdaLayers.langchain, lambdaLayers.analyticsPlatform],
      vpc,
      alarmSnsAction: alarmAction,
    });

    lambda.addEventSource(new SnsEventSource(coreTransformJobCompletionTopic, eventSource));

    dbCluster.connections.allowDefaultPortFrom(lambda);
    dbCredsSecret.grantRead(lambda);
    analyticsPlatformBucket.grantReadWrite(lambda);
    featureFlagsTable.grantReadData(lambda);

    return lambda;
  }
}
