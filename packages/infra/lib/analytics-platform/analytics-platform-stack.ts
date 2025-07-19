import * as cdk from "aws-cdk-lib";
import { Duration, NestedStack, NestedStackProps } from "aws-cdk-lib";
import * as batch from "aws-cdk-lib/aws-batch";
import { SnsAction } from "aws-cdk-lib/aws-cloudwatch-actions";
import * as ec2 from "aws-cdk-lib/aws-ec2";
import * as ecr from "aws-cdk-lib/aws-ecr";
import * as ecs from "aws-cdk-lib/aws-ecs";
import * as iam from "aws-cdk-lib/aws-iam";
import * as lambda from "aws-cdk-lib/aws-lambda";
import { SqsEventSource } from "aws-cdk-lib/aws-lambda-event-sources";
import * as s3 from "aws-cdk-lib/aws-s3";
import * as secret from "aws-cdk-lib/aws-secretsmanager";
import { Queue } from "aws-cdk-lib/aws-sqs";
import { Construct } from "constructs";
import { EnvConfigNonSandbox } from "../../config/env-config";
import { EnvType } from "../env-type";
import { createLambda } from "../shared/lambda";
import { LambdaLayers } from "../shared/lambda-layers";
import { buildSecret } from "../shared/secrets";
import { LambdaSettings, QueueAndLambdaSettings } from "../shared/settings";
import { createQueue } from "../shared/sqs";
import { AnalyticsPlatformsAssets } from "./types";

const waitTimeFhirToCsv = Duration.seconds(0); // No limit

type BatchJobSettings = {
  imageName: string;
  memory: cdk.Size;
  cpu: number;
};

type DockerImageLambdaSettings = Omit<LambdaSettings, "entry">;

interface AnalyticsPlatformsSettings {
  fhirToCsv: QueueAndLambdaSettings;
  fhirToCsvTransform: DockerImageLambdaSettings;
  fhirToCsvBatchJob: BatchJobSettings;
}

function settings(): AnalyticsPlatformsSettings {
  const fhirToCsvTransformLambdaTimeout = Duration.minutes(2);
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
      maxConcurrency: 15,
    },
    waitTime: waitTimeFhirToCsv,
  };
  const fhirToCsvTransform: DockerImageLambdaSettings = {
    name: "FhirToCsvTransform",
    lambda: {
      memory: 1024,
      timeout: fhirToCsvTransformLambdaTimeout,
    },
  };
  const fhirToCsvBatchJob: BatchJobSettings = {
    imageName: "fhir-to-csv",
    memory: cdk.Size.mebibytes(1024),
    cpu: 512,
  };
  return {
    fhirToCsv,
    fhirToCsvTransform,
    fhirToCsvBatchJob,
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
  readonly fhirToCsvTransformLambda: lambda.DockerImageFunction;
  readonly fhirToCsvQueue: Queue;
  readonly fhirToCsvBatchJob: batch.EcsJobDefinition;
  readonly fhirToCsvBatchJobContainer: batch.EcsEc2ContainerDefinition;
  readonly fhirToCsvBatchJobQueue: batch.JobQueue;

  constructor(scope: Construct, id: string, props: AnalyticsPlatformsNestedStackProps) {
    super(scope, id, props);

    this.terminationProtection = true;

    const snowflakeCreds = buildSecret(
      this,
      props.config.analyticsPlatform.secrets.SNOWFLAKE_CREDS
    );

    const analyticsPlatformBucket = new s3.Bucket(this, "AnalyticsPlatformBucket", {
      bucketName: props.config.analyticsPlatform.bucketName,
      publicReadAccess: false,
      encryption: s3.BucketEncryption.S3_MANAGED,
      versioned: true,
    });

    const analyticsPlatformRepository = new ecr.Repository(this, "AnalyticsPlatformRepository", {
      repositoryName: "metriport/analytics-platform",
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

    const analyticsPlatformComputeEnvironment = new batch.ManagedEc2EcsComputeEnvironment(
      this,
      "AnalyticsPlatformComputeEnvironment",
      {
        vpc: props.vpc,
      }
    );

    const {
      fhirToCsvLambda,
      fhirToCsvTransformLambda,
      queue: fhirToCsvQueue,
    } = this.setupFhirToCsvLambda({
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
    this.fhirToCsvTransformLambda = fhirToCsvTransformLambda;
    this.fhirToCsvQueue = fhirToCsvQueue;

    const {
      job: fhirToCsvBatchJob,
      container: fhirToCsvBatchJobContainer,
      queue: fhirToCsvBatchJobQueue,
    } = this.setupFhirToCsvBatchJob({
      config: props.config,
      envType: props.config.environmentType,
      awsRegion: props.config.region,
      analyticsPlatformComputeEnvironment,
      analyticsPlatformRepository,
      analyticsPlatformBucket,
      medicalDocumentsBucket: props.medicalDocumentsBucket,
      snowflakeCreds: snowflakeCreds,
    });
    this.fhirToCsvBatchJob = fhirToCsvBatchJob;
    this.fhirToCsvBatchJobContainer = fhirToCsvBatchJobContainer;
    this.fhirToCsvBatchJobQueue = fhirToCsvBatchJobQueue;
  }

  getAssets(): AnalyticsPlatformsAssets {
    return {
      fhirToCsvLambda: this.fhirToCsvLambda,
      fhirToCsvTransformLambda: this.fhirToCsvTransformLambda,
      fhirToCsvQueue: this.fhirToCsvQueue,
      fhirToCsvBatchJob: this.fhirToCsvBatchJob,
      fhirToCsvBatchJobContainer: this.fhirToCsvBatchJobContainer,
      fhirToCsvBatchJobQueue: this.fhirToCsvBatchJobQueue,
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
    fhirToCsvTransformLambda: lambda.DockerImageFunction;
    queue: Queue;
  } {
    const { lambda: fhirToCsvTransformLambdaSettings, name: fhirToCsvTransformLambdaName } =
      settings().fhirToCsvTransform;

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
        environment: {
          ENV: ownProps.envType,
          INPUT_S3_BUCKET: ownProps.medicalDocumentsBucket.bucketName,
          OUTPUT_S3_BUCKET: ownProps.analyticsPlatformBucket.bucketName,
          SNOWFLAKE_ROLE: ownProps.config.analyticsPlatform.snowflake.role,
          SNOWFLAKE_WAREHOUSE: ownProps.config.analyticsPlatform.snowflake.warehouse,
          SNOWFLAKE_INTEGRATION: ownProps.config.analyticsPlatform.snowflake.integrationName,
        },
      }
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
        FHIR_TO_CSV_TRANSFORM_LAMBDA_ARN: fhirToCsvTransformLambda.functionArn,
        ...(sentryDsn ? { SENTRY_DSN: sentryDsn } : {}),
      },
      layers: [lambdaLayers.shared],
      vpc,
      alarmSnsAction: alarmAction,
    });

    fhirToCsvLambda.addEventSource(new SqsEventSource(queue, eventSourceSettings));

    return {
      fhirToCsvLambda,
      fhirToCsvTransformLambda,
      queue,
    };
  }

  private setupFhirToCsvBatchJob(ownProps: {
    config: EnvConfigNonSandbox;
    envType: EnvType;
    awsRegion: string;
    analyticsPlatformComputeEnvironment: batch.ManagedEc2EcsComputeEnvironment;
    analyticsPlatformRepository: ecr.Repository;
    analyticsPlatformBucket: s3.Bucket;
    medicalDocumentsBucket: s3.Bucket;
    snowflakeCreds: secret.ISecret;
  }): {
    job: batch.EcsJobDefinition;
    container: batch.EcsEc2ContainerDefinition;
    queue: batch.JobQueue;
  } {
    const { imageName, memory, cpu } = settings().fhirToCsvBatchJob;

    const container = new batch.EcsEc2ContainerDefinition(this, "FhirToCsvContainerDef", {
      image: ecs.ContainerImage.fromEcrRepository(
        ownProps.analyticsPlatformRepository,
        `${imageName}-latest`
      ),
      memory,
      cpu,
      environment: {
        ENV: ownProps.envType,
        AWS_REGION: ownProps.awsRegion,
        INPUT_S3_BUCKET: ownProps.medicalDocumentsBucket.bucketName,
        OUTPUT_S3_BUCKET: ownProps.analyticsPlatformBucket.bucketName,
        SNOWFLAKE_ROLE: ownProps.config.analyticsPlatform.snowflake.role,
        SNOWFLAKE_WAREHOUSE: ownProps.config.analyticsPlatform.snowflake.warehouse,
        SNOWFLAKE_INTEGRATION: ownProps.config.analyticsPlatform.snowflake.integrationName,
      },
      secrets: {
        SNOWFLAKE_CREDS: batch.Secret.fromSecretsManager(
          ownProps.snowflakeCreds,
          "SNOWFLAKE_CREDS"
        ),
      },
      command: [
        "python",
        "main.py",
        "-e",
        "JOB_ID=Ref::jobId",
        "-e",
        "CX_ID=Ref::cxId",
        "-e",
        "PATIENT_ID=Ref::patientId",
        "-e",
        "INPUT_BUNDLE=Ref::inputBundle",
        "-e",
        "API_URL=Ref::apiUrl",
      ],
    });

    const job = new batch.EcsJobDefinition(this, "FhirToCsvBatchJob", {
      jobDefinitionName: "FhirToCsvBatchJob",
      container,
      parameters: {
        jobId: "default",
        cxId: "default",
        patientId: "default",
        inputBundle: "default",
        apiUrl: "default",
      },
    });

    const queue = new batch.JobQueue(this, "FhirToCsvJobQueue", {
      computeEnvironments: [
        {
          computeEnvironment: ownProps.analyticsPlatformComputeEnvironment,
          order: 1,
        },
      ],
      priority: 10,
    });

    // Grant read to medical document bucket set on the api-stack
    ownProps.analyticsPlatformBucket.grantReadWrite(container.executionRole);

    return { job, container, queue };
  }
}
