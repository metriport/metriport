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
  alertSnsAction?: SnsAction;
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

export function createReceiveAllScheduledLambda(props: ScheduledLambdaProps): Lambda {
  return createSurescriptsScheduledLambda({
    ...props,
    name: "SurescriptsScheduledIngestAllResponses",
    /**
     * UTC-based: "Minutes Hours Day-of-month Month Day-of-week Year"
     * @see: https://docs.aws.amazon.com/eventbridge/latest/userguide/eb-cron-expressions.html
     * @see: https://docs.aws.amazon.com/lambda/latest/dg/services-cloudwatchevents-expressions.html
     */
    scheduleExpression: [
      "0 */3 * * ? *", // Every 3 hours
    ],
    url: `http://${props.apiAddress}/internal/surescripts/ingest-all-responses`,
  });
}

export function createUploadRosterScheduledLambdaBackfill(props: ScheduledLambdaProps): Lambda {
  return createSurescriptsScheduledLambda({
    ...props,
    name: "SurescriptsScheduledRosterUploadBackfill",
    /**
     * UTC-based: "Minutes Hours Day-of-month Month Day-of-week Year"
     * @see: https://docs.aws.amazon.com/eventbridge/latest/userguide/eb-cron-expressions.html
     * @see: https://docs.aws.amazon.com/lambda/latest/dg/services-cloudwatchevents-expressions.html
     */
    scheduleExpression: [
      "0 12 * * ? *", // Every day at 5:00am PST (12:00 UTC)
      "0 22 * * ? *", // Every day at 3:00pm PST (22:00 UTC)
    ],
    url: `http://${props.apiAddress}/internal/surescripts/upload-roster/backfill`,
  });
}

function createSurescriptsScheduledLambda(props: ScheduledLambdaConfig): Lambda {
  const config = getConfig();
  const { stack, lambdaLayers, vpc, name, scheduleExpression, url, alertSnsAction } = props;

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
    alertSnsAction,
  });

  return lambda;
}
