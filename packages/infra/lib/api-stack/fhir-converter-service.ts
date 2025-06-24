import { Duration, StackProps } from "aws-cdk-lib";
import * as cloudwatch from "aws-cdk-lib/aws-cloudwatch";
import { Metric } from "aws-cdk-lib/aws-cloudwatch";
import { SnsAction } from "aws-cdk-lib/aws-cloudwatch-actions";
import * as ec2 from "aws-cdk-lib/aws-ec2";
import * as ecr_assets from "aws-cdk-lib/aws-ecr-assets";
import * as ecs from "aws-cdk-lib/aws-ecs";
import { FargateService } from "aws-cdk-lib/aws-ecs";
import * as ecs_patterns from "aws-cdk-lib/aws-ecs-patterns";
import { Runtime } from "aws-cdk-lib/aws-lambda";
import * as nodejs from "aws-cdk-lib/aws-lambda-nodejs";
import { FilterPattern } from "aws-cdk-lib/aws-logs";
import * as s3 from "aws-cdk-lib/aws-s3";
import { Bucket } from "aws-cdk-lib/aws-s3";
import { Construct } from "constructs";
import path from "path";
import { EnvConfigNonSandbox } from "../../config/env-config";
import { getConfig, METRICS_NAMESPACE } from "../shared/config";
import { vCPU } from "../shared/fargate";
import { addErrorAlarmToLambdaFunc, MAXIMUM_LAMBDA_TIMEOUT } from "../shared/lambda";
import { buildLbAccessLogPrefix } from "../shared/s3";
import { addDefaultMetricsToTargetGroup } from "../shared/target-group";
import { isProd } from "../shared/util";

export function settings() {
  const config = getConfig();
  const prod = isProd(config);
  // Watch out for the combination of vCPUs and memory, more vCPU requires more memory
  // https://docs.aws.amazon.com/AmazonECS/latest/developerguide/task_definition_parameters.html#task_size
  const cpuAmount = prod ? 4 : 2;
  return {
    cpuAmount,
    cpu: cpuAmount * vCPU,
    memoryLimitMiB: prod ? 8192 : 4096,
    taskCountMin: prod ? 32 : 1,
    taskCountMax: prod ? 64 : 4,
    // How long this service can run for
    maxExecutionTimeout: MAXIMUM_LAMBDA_TIMEOUT,
  };
}

interface FhirConverterServiceProps extends StackProps {
  config: EnvConfigNonSandbox;
  version: string | undefined;
  generalBucket: Bucket;
}

export function createFHIRConverterService(
  stack: Construct,
  props: FhirConverterServiceProps,
  vpc: ec2.IVpc,
  alarmAction: SnsAction | undefined
): { service: FargateService; address: string; lambda: nodejs.NodejsFunction; bucket: s3.Bucket } {
  const { cpu, memoryLimitMiB, taskCountMin, taskCountMax, maxExecutionTimeout } = settings();

  // Create a new Amazon Elastic Container Service (ECS) cluster
  const cluster = new ecs.Cluster(stack, "FHIRConverterCluster", { vpc, containerInsights: true });

  // Create a Docker image and upload it to the Amazon Elastic Container Registry (ECR)
  const dockerImage = new ecr_assets.DockerImageAsset(stack, "FHIRConverterImage", {
    directory: "../fhir-converter",
  });

  // Run some servers on fargate containers
  const fargateService = new ecs_patterns.ApplicationLoadBalancedFargateService(
    stack,
    "FHIRConverterFargateService",
    {
      cluster: cluster,
      cpu,
      memoryLimitMiB,
      desiredCount: taskCountMin,
      taskImageOptions: {
        image: ecs.ContainerImage.fromDockerImageAsset(dockerImage),
        containerPort: 8080,
        containerName: "FHIRConverter-Server",
        environment: {
          NODE_ENV: "production", // Determines its being run in the cloud, the logical env is set on ENV_TYPE
          ENV_TYPE: props.config.environmentType, // staging, production, sandbox
          ...(props.version ? { METRIPORT_VERSION: props.version } : undefined),
        },
      },
      healthCheckGracePeriod: Duration.seconds(60),
      publicLoadBalancer: false,
      idleTimeout: maxExecutionTimeout,
    }
  );
  const serverAddress = fargateService.loadBalancer.loadBalancerDnsName;

  fargateService.loadBalancer.logAccessLogs(
    props.generalBucket,
    buildLbAccessLogPrefix("fhir-converter")
  );

  // CloudWatch Alarms and Notifications
  const fargateCPUAlarm = fargateService.service
    .metricCpuUtilization()
    .createAlarm(stack, "FHIRConverterCPUAlarm", {
      threshold: 80,
      evaluationPeriods: 3,
      datapointsToAlarm: 2,
      treatMissingData: cloudwatch.TreatMissingData.NOT_BREACHING,
    });
  alarmAction && fargateCPUAlarm.addAlarmAction(alarmAction);
  alarmAction && fargateCPUAlarm.addOkAction(alarmAction);

  const fargateMemoryAlarm = fargateService.service
    .metricMemoryUtilization()
    .createAlarm(stack, "FHIRConverterMemoryAlarm", {
      threshold: 70,
      evaluationPeriods: 3,
      datapointsToAlarm: 2,
      treatMissingData: cloudwatch.TreatMissingData.NOT_BREACHING,
    });
  alarmAction && fargateMemoryAlarm.addAlarmAction(alarmAction);
  alarmAction && fargateMemoryAlarm.addOkAction(alarmAction);

  // allow the NLB to talk to fargate
  fargateService.service.connections.allowFrom(
    ec2.Peer.ipv4(vpc.vpcCidrBlock),
    ec2.Port.allTraffic(),
    "Allow traffic from within the VPC to the service secure port"
  );
  // TODO: #489 ain't the most secure, but the above code doesn't work as CDK complains we can't use the connections
  // from the cluster created above, should be fine for now as it will only accept connections in the VPC
  fargateService.service.connections.allowFromAnyIpv4(ec2.Port.allTcp());

  // This speeds up deployments so the tasks are swapped quicker.
  // See for details: https://docs.aws.amazon.com/elasticloadbalancing/latest/application/load-balancer-target-groups.html#deregistration-delay
  fargateService.targetGroup.setAttribute("deregistration_delay.timeout_seconds", "17");

  // This also speeds up deployments so the health checks have a faster turnaround.
  // See for details: https://docs.aws.amazon.com/elasticloadbalancing/latest/network/target-group-health-checks.html
  fargateService.targetGroup.configureHealthCheck({
    healthyThresholdCount: 2,
    interval: Duration.seconds(10),
  });

  const scaling = fargateService.service.autoScaleTaskCount({
    minCapacity: taskCountMin,
    maxCapacity: taskCountMax,
  });
  scaling.scaleOnCpuUtilization("autoscale_cpu", {
    targetUtilizationPercent: 60,
    scaleInCooldown: Duration.minutes(2),
    scaleOutCooldown: Duration.seconds(30),
  });
  scaling.scaleOnMemoryUtilization("autoscale_mem", {
    targetUtilizationPercent: 80,
    scaleInCooldown: Duration.minutes(2),
    scaleOutCooldown: Duration.seconds(30),
  });

  const targetGroup = fargateService.targetGroup;
  addDefaultMetricsToTargetGroup({
    targetGroup,
    scope: stack,
    id: "FhirConverter",
    alarmAction,
  });

  const bucket = new s3.Bucket(stack, "FhirConversionBucket", {
    bucketName: props.config.fhirConversionBucketName,
    publicReadAccess: false,
    encryption: s3.BucketEncryption.S3_MANAGED,
    versioned: true,
  });

  const name = "FhirConversionNodeJsLambda";
  const lambda = new nodejs.NodejsFunction(stack, name, {
    functionName: name,
    entry: path.join(
      __dirname,
      "..",
      "..",
      "..",
      "..",
      "fhir-converter",
      "src",
      "ccda-to-fhir-lambda-nodelambda.js"
    ),
    timeout: Duration.minutes(10),
    memorySize: 4096,
    handler: "handler",
    runtime: Runtime.NODEJS_18_X,
    bundling: {
      sourceMap: true,
      commandHooks: {
        beforeBundling(inputDir: string, outputDir: string): string[] {
          return [`cp -r ${inputDir}/packages/fhir-converter/src/templates/ ${outputDir}/`];
        },
        afterBundling(): string[] {
          return [];
        },
        beforeInstall(): string[] {
          return [];
        },
      },
      environment: {
        NODE_ENV: "production", // Determines its being run in the cloud, the logical env is set on ENV_TYPE
        ENV_TYPE: props.config.environmentType, // staging, production, sandbox
        ...(props.version ? { METRIPORT_VERSION: props.version } : undefined),
      },
    },
  });

  // Allow the lambda to publish metrics to cloudwatch
  Metric.grantPutMetricData(lambda);

  // Setup alarm - general errors
  addErrorAlarmToLambdaFunc(stack, lambda, `${name}-GeneralLambdaAlarm`, alarmAction);

  // Setup alarm - OOM (Out Of Memory) errors
  const metricFilter = lambda.logGroup?.addMetricFilter(`${props.name}-OOMErrorsFilter`, {
    metricNamespace: METRICS_NAMESPACE,
    metricName: `${name}-OOMErrors`,
    filterPattern: FilterPattern.anyTerm(
      "Runtime exited with error",
      "signal: killed Runtime.ExitError",
      "ELIFECYCLE",
      "JS heap out of memory",
      "OUT_OF_MEMORY"
    ),
    metricValue: "1",
  });
  const metric = metricFilter?.metric();
  if (metric) {
    const alarm = metric.createAlarm(stack, `${name}-OOMLambdaAlarm`, {
      threshold: 1,
      evaluationPeriods: 1,
      alarmDescription: "Alarm if we get an OOM error from the Lambda function",
      treatMissingData: cloudwatch.TreatMissingData.NOT_BREACHING,
    });
    alarmAction && alarm.addAlarmAction(alarmAction);
  }

  return {
    service: fargateService.service,
    address: serverAddress,
    lambda,
    bucket,
  };
}
