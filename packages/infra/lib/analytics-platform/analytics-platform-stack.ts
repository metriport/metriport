import cdk, { NestedStack, NestedStackProps } from "aws-cdk-lib";
import * as batch from "aws-cdk-lib/aws-batch";
import * as ec2 from "aws-cdk-lib/aws-ec2";
import * as ecr from "aws-cdk-lib/aws-ecr";
import * as ecs from "aws-cdk-lib/aws-ecs";
import * as iam from "aws-cdk-lib/aws-iam";
import * as s3 from "aws-cdk-lib/aws-s3";
import { Construct } from "constructs";
import { EnvConfigNonSandbox } from "../../config/env-config";
import { EnvType } from "../env-type";
import { AnalyticsPlatformsAssets } from "./types";

type BatchJobSettings = {
  imageName: string;
  memory: cdk.Size;
  cpu: number;
};

interface AnalyticsPlatformsSettings {
  fhirToCsvBatchJob: BatchJobSettings;
  csvToMetricsBatchJob: BatchJobSettings;
}

function settings(): AnalyticsPlatformsSettings {
  return {
    fhirToCsvBatchJob: {
      imageName: "fhir-to-csv",
      memory: cdk.Size.mebibytes(1024),
      cpu: 512,
    },
    csvToMetricsBatchJob: {
      imageName: "csv-to-metrics",
      memory: cdk.Size.mebibytes(1024),
      cpu: 512,
    },
  };
}

interface AnalyticsPlatformsNestedStackProps extends NestedStackProps {
  config: EnvConfigNonSandbox;
  vpc: ec2.IVpc;
  medicalDocumentsBucket: s3.Bucket;
}

export class AnalyticsPlatformsNestedStack extends NestedStack {
  readonly fhirToCsvBatchJob: batch.EcsJobDefinition;
  readonly fhirToCsvContainer: batch.EcsEc2ContainerDefinition;
  readonly fhirToCsvQueue: batch.JobQueue;
  readonly csvToMetricsBatchJob: batch.EcsJobDefinition;
  readonly csvToMetricsContainer: batch.EcsEc2ContainerDefinition;
  readonly csvToMetricsQueue: batch.JobQueue;

  constructor(scope: Construct, id: string, props: AnalyticsPlatformsNestedStackProps) {
    super(scope, id, props);

    this.terminationProtection = true;

    const analyticsPlatformBucket = new s3.Bucket(this, "AnalyticsPlatformBucket", {
      bucketName: props.config.analyticsPlatform.bucketName,
      publicReadAccess: false,
      encryption: s3.BucketEncryption.S3_MANAGED,
      versioned: true,
    });

    // Snowflake access via S3 Integration https://docs.snowflake.com/en/user-guide/data-load-s3-config-storage-integration
    const snowflakePrefix = "snowflake";
    const s3Policy = new iam.Policy(this, "SnowflakeAnalyticsPlatformS3Policy", {
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
      assumedBy: new iam.AccountPrincipal(
        props.config.analyticsPlatform.snowflake.integrationUserArn
      ),
      externalIds: [props.config.analyticsPlatform.snowflake.integrationExternalId],
      inlinePolicies: {
        SnowflakeAnalyticsPlatformS3Policy: s3Policy.document,
      },
    });

    const analyticsPlatformRepository = new ecr.Repository(this, "AnalyticsPlatformRepository", {
      repositoryName: "analytics-platform-repository",
    });

    const analyticsPlatformComputeEnvironment = new batch.ManagedEc2EcsComputeEnvironment(
      this,
      "AnalyticsPlatformComputeEnvironment",
      {
        vpc: props.vpc,
      }
    );

    const {
      job: fhirToCsvBatchJob,
      container: fhirToCsvContainer,
      queue: fhirToCsvQueue,
    } = this.setupFhirToCsvBatchJob({
      config: props.config,
      envType: props.config.environmentType,
      awsRegion: props.config.region,
      analyticsPlatformComputeEnvironment,
      analyticsPlatformRepository,
      analyticsPlatformBucket,
      medicalDocumentsBucket: props.medicalDocumentsBucket,
    });
    this.fhirToCsvBatchJob = fhirToCsvBatchJob;
    this.fhirToCsvContainer = fhirToCsvContainer;
    this.fhirToCsvQueue = fhirToCsvQueue;

    const {
      job: csvToMetricsBatchJob,
      container: csvToMetricsContainer,
      queue: csvToMetricsQueue,
    } = this.setupCsvToMetricsBatchJob({
      config: props.config,
      envType: props.config.environmentType,
      analyticsPlatformComputeEnvironment,
      analyticsPlatformRepository,
      analyticsPlatformBucket,
    });
    this.csvToMetricsBatchJob = csvToMetricsBatchJob;
    this.csvToMetricsContainer = csvToMetricsContainer;
    this.csvToMetricsQueue = csvToMetricsQueue;
  }

  getAssets(): AnalyticsPlatformsAssets {
    return {
      fhirToCsvBatchJob: this.fhirToCsvBatchJob,
      fhirToCsvContainer: this.fhirToCsvContainer,
      fhirToCsvQueue: this.fhirToCsvQueue,
      csvToMetricsBatchJob: this.csvToMetricsBatchJob,
      csvToMetricsContainer: this.csvToMetricsContainer,
      csvToMetricsQueue: this.csvToMetricsQueue,
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
    });

    const job = new batch.EcsJobDefinition(this, "FhirToCsvBatchJob", {
      jobDefinitionName: "FhirToCsvBatchJob",
      container,
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
    ownProps.medicalDocumentsBucket.grantReadWrite(container.executionRole);

    return { job, container, queue };
  }

  private setupCsvToMetricsBatchJob(ownProps: {
    config: EnvConfigNonSandbox;
    envType: EnvType;
    analyticsPlatformComputeEnvironment: batch.ManagedEc2EcsComputeEnvironment;
    analyticsPlatformRepository: ecr.Repository;
    analyticsPlatformBucket: s3.Bucket;
  }): {
    job: batch.EcsJobDefinition;
    container: batch.EcsEc2ContainerDefinition;
    queue: batch.JobQueue;
  } {
    const { analyticsPlatformRepository } = ownProps;
    const { imageName, memory, cpu } = settings().csvToMetricsBatchJob;

    const container = new batch.EcsEc2ContainerDefinition(this, "FhirToCsvContainerDef", {
      image: ecs.ContainerImage.fromEcrRepository(
        analyticsPlatformRepository,
        `${imageName}-latest`
      ),
      memory,
      cpu,
      environment: {
        ENV: ownProps.envType,
        DBT_TARGET: ownProps.envType === EnvType.production ? "production" : "staging",
        DBT_SNOWFLAKE_CI_ROLE: ownProps.config.analyticsPlatform.snowflake.role,
        DBT_SNOWFLAKE_CI_WAREHOUSE: ownProps.config.analyticsPlatform.snowflake.warehouse,
      },
      volumes: [
        {
          name: "csv-to-metrics-volume",
          containerPath: "/usr/app/data",
        },
      ],
    });

    const job = new batch.EcsJobDefinition(this, "CsvToMetricsBatchJob", {
      jobDefinitionName: "CsvToMetricsBatchJob",
      container,
    });

    const queue = new batch.JobQueue(this, "CsvToMetricsJobQueue", {
      computeEnvironments: [
        {
          computeEnvironment: ownProps.analyticsPlatformComputeEnvironment,
          order: 1,
        },
      ],
      priority: 10,
    });

    ownProps.analyticsPlatformBucket.grantReadWrite(container.executionRole);

    return { job, container, queue };
  }
}
