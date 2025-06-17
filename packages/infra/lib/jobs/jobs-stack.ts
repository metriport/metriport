import { Duration, NestedStack, NestedStackProps } from "aws-cdk-lib";
import { SnsAction } from "aws-cdk-lib/aws-cloudwatch-actions";
import * as ec2 from "aws-cdk-lib/aws-ec2";
import { Function as Lambda } from "aws-cdk-lib/aws-lambda";
import { SqsEventSource } from "aws-cdk-lib/aws-lambda-event-sources";
import { Queue } from "aws-cdk-lib/aws-sqs";
import { Construct } from "constructs";
import { EnvConfig } from "../../config/env-config";
import { EnvType } from "../env-type";
import { createLambda } from "../shared/lambda";
import { LambdaLayers } from "../shared/lambda-layers";
import { createScheduledLambda } from "../shared/lambda-scheduled";
import { LambdaSettings, QueueAndLambdaSettings } from "../shared/settings";
import { createQueue } from "../shared/sqs";
import { JobsAssets } from "./types";

const triggerPatientJobsLambdaTimeout = Duration.minutes(5);
const runPatientJobQueueTimeout = Duration.seconds(30);
const apiUrlEnvVarName = "API_URL";
const parallelJobExecutions = 4;

interface JobsSettings {
  triggerPatientJobs: LambdaSettings;
  runPatientJob: QueueAndLambdaSettings;
}

function settings(): JobsSettings {
  return {
    triggerPatientJobs: {
      name: "JobsTriggerPatientJobs",
      entry: "jobs/patient/trigger-jobs",
      lambda: {
        memory: 1024,
        timeout: triggerPatientJobsLambdaTimeout,
      },
    },
    runPatientJob: {
      name: "JobsRunPatientJob",
      entry: "jobs/patient/run-job",
      lambda: {
        memory: 1024,
        timeout: runPatientJobQueueTimeout,
      },
      queue: {
        alarmMaxAgeOfOldestMessage: Duration.hours(1),
        maxMessageCountAlarmThreshold: 15_000,
        maxReceiveCount: 3,
        visibilityTimeout: Duration.seconds(runPatientJobQueueTimeout.toSeconds() * 2 + 1),
        createRetryLambda: false,
      },
      eventSource: {
        batchSize: 1,
        reportBatchItemFailures: true,
        maxConcurrency: parallelJobExecutions,
      },
      waitTime: Duration.seconds(0),
    },
  };
}

interface JobsNestedStackProps extends NestedStackProps {
  config: EnvConfig;
  vpc: ec2.IVpc;
  alarmAction?: SnsAction;
  lambdaLayers: LambdaLayers;
}

export class JobsNestedStack extends NestedStack {
  private readonly triggerPatientJobsLambda: Lambda;
  private readonly runPatientJobQueue: Queue;
  private readonly runPatientJobLambda: Lambda;

  constructor(scope: Construct, id: string, props: JobsNestedStackProps) {
    super(scope, id, props);

    this.terminationProtection = true;

    const commonConfig = {
      lambdaLayers: props.lambdaLayers,
      vpc: props.vpc,
      envType: props.config.environmentType,
      sentryDsn: props.config.lambdasSentryDSN,
      alarmAction: props.alarmAction,
    };

    createScheduledLambda({
      stack: this,
      envType: props.config.environmentType,
      layers: [props.lambdaLayers.shared],
      alarmSnsAction: props.alarmAction,
      name: "StartPatientJobsScheduler",
      scheduleExpression: props.config.jobs.startPatientJobsSchedulerScheduleExpression,
      url: props.config.jobs.startPatientJobsSchedulerUrl,
    });

    const runPatientJob = this.setupRunPatientJob({
      ...commonConfig,
    });
    this.runPatientJobQueue = runPatientJob.queue;
    this.runPatientJobLambda = runPatientJob.lambda;

    const triggerPatientJobs = this.setupTriggerPatientJobsLambda({
      ...commonConfig,
      runPatientJobQueue: this.runPatientJobQueue,
    });
    this.triggerPatientJobsLambda = triggerPatientJobs;
  }

  getAssets(): JobsAssets {
    return {
      triggerPatientJobsLambda: this.triggerPatientJobsLambda,
      runPatientJobQueue: this.runPatientJobQueue,
      runPatientJobLambda: this.runPatientJobLambda,
    };
  }

  setApiUrl(apiUrl: string): void {
    const lambdasToSetApiUrl = [this.triggerPatientJobsLambda, this.runPatientJobLambda];
    lambdasToSetApiUrl.forEach(lambda => lambda.addEnvironment(apiUrlEnvVarName, apiUrl));
  }

  private setupTriggerPatientJobsLambda(ownProps: {
    lambdaLayers: LambdaLayers;
    vpc: ec2.IVpc;
    envType: EnvType;
    sentryDsn: string | undefined;
    alarmAction: SnsAction | undefined;
    runPatientJobQueue: Queue;
  }): Lambda {
    const { lambdaLayers, vpc, envType, sentryDsn, alarmAction } = ownProps;
    const { name, entry, lambda: lambdaSettings } = settings().triggerPatientJobs;

    const lambda = createLambda({
      ...lambdaSettings,
      stack: this,
      name,
      entry,
      envType,
      envVars: {
        // API_URL set on the api-stack after the OSS API is created
        RUN_PATIENT_JOB_QUEUE_URL: ownProps.runPatientJobQueue.queueUrl,
        ...(sentryDsn ? { SENTRY_DSN: sentryDsn } : {}),
      },
      layers: [lambdaLayers.shared],
      vpc,
      alarmSnsAction: alarmAction,
    });

    ownProps.runPatientJobQueue.grantSendMessages(lambda);

    return lambda;
  }

  private setupRunPatientJob(ownProps: {
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
      lambda: lambdaSettings,
      queue: queueSettings,
      eventSource: eventSourceSettings,
      waitTime,
    } = settings().runPatientJob;

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
}
