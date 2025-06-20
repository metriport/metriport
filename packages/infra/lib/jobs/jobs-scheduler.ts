import { SnsAction } from "aws-cdk-lib/aws-cloudwatch-actions";
import { IVpc } from "aws-cdk-lib/aws-ec2";
import { Construct } from "constructs";
import { EnvConfig } from "../../config/env-config";
import { getConfig } from "../shared/config";
import { LambdaLayers } from "../shared/lambda-layers";
import { createScheduledLambda } from "../shared/lambda-scheduled";

export type JobsSchedulerProps = {
  stack: Construct;
  lambdaLayers: LambdaLayers;
  vpc: IVpc;
  apiAddress: string;
  alarmSnsAction?: SnsAction;
};

function getSettings(props: JobsSchedulerProps, config: NonNullable<EnvConfig["jobs"]>) {
  return {
    ...props,
    name: "StartPatientJobsScheduler",
    scheduleExpression: config.startPatientJobsSchedulerScheduleExpression, // See: https://docs.aws.amazon.com/lambda/latest/dg/services-cloudwatchevents-expressions.html
    url: `http://${props.apiAddress}${config.startPatientJobsSchedulerUrl}`,
  };
}

export function createJobsScheduler(props: JobsSchedulerProps) {
  const config = getConfig();
  if (!config.jobs) return;

  const { stack, lambdaLayers, vpc, alarmSnsAction, name, scheduleExpression, url } = getSettings(
    props,
    config.jobs
  );

  createScheduledLambda({
    stack,
    layers: [lambdaLayers.shared],
    name,
    vpc,
    scheduleExpression,
    url,
    alarmSnsAction,
    envType: config.environmentType,
  });
}
