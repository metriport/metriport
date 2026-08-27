import { Duration } from "aws-cdk-lib";
import { SnsAction } from "aws-cdk-lib/aws-cloudwatch-actions";
import { IVpc } from "aws-cdk-lib/aws-ec2";
import { Function as Lambda } from "aws-cdk-lib/aws-lambda";
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

export function createRawToCoreScheduledLambdaNotifications(props: ScheduledLambdaProps): Lambda {
  return createAnalyticsPlatformScheduledLambda({
    ...props,
    name: "RawToCoreScheduledLambdaNotifications",
    /**
     * UTC-based: "Minutes Hours Day-of-month Month Day-of-week Year"
     * @see: https://docs.aws.amazon.com/eventbridge/latest/userguide/eb-cron-expressions.html
     * @see: https://docs.aws.amazon.com/lambda/latest/dg/services-cloudwatchevents-expressions.html
     */
    scheduleExpression: [
      "0/30 * * * ? *", // Every 30 minutes
    ],
    url: `http://${props.apiAddress}/internal/analytics-platform/core/incremental`,
  });
}

function createAnalyticsPlatformScheduledLambda(props: ScheduledLambdaConfig): Lambda {
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
