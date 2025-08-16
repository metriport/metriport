import { Duration } from "aws-cdk-lib";
import { IVpc } from "aws-cdk-lib/aws-ec2";
import { IFunction } from "aws-cdk-lib/aws-lambda";
import { SnsAction } from "aws-cdk-lib/aws-cloudwatch-actions";
import { Construct } from "constructs";
import { getConfig } from "../shared/config";
import { LambdaLayers } from "../shared/lambda-layers";
import { createScheduledLambda } from "../shared/lambda-scheduled";

export type RosterUploadProps = {
  stack: Construct;
  lambdaLayers: LambdaLayers;
  alarmSnsAction?: SnsAction | undefined;
  vpc: IVpc;
  apiAddress: string;
};

function getSettings(props: RosterUploadProps) {
  return {
    ...props,
    name: "QuestScheduledRosterUpload",
    /**
     * UTC-based: "Minutes Hours Day-of-month Month Day-of-week Year"
     * @see: https://docs.aws.amazon.com/eventbridge/latest/userguide/eb-cron-expressions.html
     * @see: https://docs.aws.amazon.com/lambda/latest/dg/services-cloudwatchevents-expressions.html
     */
    scheduleExpression: ["0 12 * * *"], // Every day at 12:00pm UTC (5:00am PST)
    url: `http://${props.apiAddress}/internal/quest/upload-roster`,
    lambdaTimeout: Duration.seconds(60), // How long can the lambda run for, max is 900 seconds (15 minutes)
    httpTimeout: Duration.seconds(50),
  };
}

export function createQuestScheduledRosterUpload(props: RosterUploadProps): IFunction {
  const config = getConfig();
  const { stack, lambdaLayers, vpc, name, lambdaTimeout, scheduleExpression, url, httpTimeout } =
    getSettings(props);

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
