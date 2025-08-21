import { Duration } from "aws-cdk-lib";
import { IVpc } from "aws-cdk-lib/aws-ec2";
import { IFunction } from "aws-cdk-lib/aws-lambda";
import { Schedule } from "aws-cdk-lib/aws-events";
import { SnsAction } from "aws-cdk-lib/aws-cloudwatch-actions";
import { Construct } from "constructs";
import { getConfig } from "../shared/config";
import { LambdaLayers } from "../shared/lambda-layers";
import { createScheduledLambda } from "../shared/lambda-scheduled";

export type ScheduledLambdaProps = {
  stack: Construct;
  lambdaLayers: LambdaLayers;
  alarmSnsAction?: SnsAction | undefined;
  vpc: IVpc;
  apiAddress: string;
};

export interface ScheduledLambdaConfig extends ScheduledLambdaProps {
  name: string;
  scheduleExpression: string[];
  url: string;
}

const lambdaTimeout = Duration.seconds(60);
const httpTimeout = Duration.seconds(50);

function configForResponseDownload(props: ScheduledLambdaProps): ScheduledLambdaConfig {
  return {
    ...props,
    name: "QuestScheduledResponseDownload",
    /**
     * UTC-based: "Minutes Hours Day-of-month Month Day-of-week Year"
     * @see: https://docs.aws.amazon.com/eventbridge/latest/userguide/eb-cron-expressions.html
     * @see: https://docs.aws.amazon.com/lambda/latest/dg/services-cloudwatchevents-expressions.html
     */
    scheduleExpression: [
      Schedule.cron({
        minute: "0",
        hour: "12",
        day: "*",
        month: "*",
        year: "*",
        weekDay: "?",
      }).expressionString, // Every day at 12:00pm UTC (5:00am PST)
    ],
    url: `http://${props.apiAddress}/internal/quest/download-response`,
  };
}

function configForRosterUpload(props: ScheduledLambdaProps): ScheduledLambdaConfig {
  return {
    ...props,
    name: "QuestScheduledRosterUpload",
    /**
     * UTC-based: "Minutes Hours Day-of-month Month Day-of-week Year"
     * @see: https://docs.aws.amazon.com/eventbridge/latest/userguide/eb-cron-expressions.html
     * @see: https://docs.aws.amazon.com/lambda/latest/dg/services-cloudwatchevents-expressions.html
     */
    scheduleExpression: [
      Schedule.cron({
        minute: "0",
        hour: "12",
        day: "*",
        month: "*",
        year: "*",
        weekDay: "1",
      }).expressionString, // Every Monday at 12:00pm UTC (5:00am PST)
    ],
    url: `http://${props.apiAddress}/internal/quest/upload-roster`,
  };
}

export function createResponseDownloadScheduledLambda(props: ScheduledLambdaProps): IFunction {
  return createQuestScheduledLambda(configForResponseDownload(props));
}

export function createRosterUploadScheduledLambda(props: ScheduledLambdaProps): IFunction {
  return createQuestScheduledLambda(configForRosterUpload(props));
}

function createQuestScheduledLambda(props: ScheduledLambdaConfig): IFunction {
  const config = getConfig();
  const { stack, lambdaLayers, vpc, name, scheduleExpression, url } = props;

  const lambda = createScheduledLambda({
    stack,
    layers: [lambdaLayers.shared],
    name,
    vpc,
    scheduleExpression,
    url,
    timeout: lambdaTimeout,
    envType: config.environmentType,
    envVars: {
      TIMEOUT_MILLIS: String(httpTimeout.toMilliseconds()),
      ...(config.lambdasSentryDSN ? { SENTRY_DSN: config.lambdasSentryDSN } : {}),
    },
  });

  return lambda;
}
