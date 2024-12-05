import { Duration } from "aws-cdk-lib";
import { IVpc } from "aws-cdk-lib/aws-ec2";
import { IFunction } from "aws-cdk-lib/aws-lambda";
import { Construct } from "constructs";
import { getConfig } from "../shared/config";
import { LambdaLayers } from "../shared/lambda-layers";
import { createScheduledLambda } from "../shared/lambda-scheduled";

export type EnhancedCoverageConnectorProps = {
  stack: Construct;
  lambdaLayers: LambdaLayers;
  vpc: IVpc;
  apiAddress: string;
};

function getSettings(props: EnhancedCoverageConnectorProps) {
  return {
    ...props,
    name: "ScheduledDBMaintenance",
    /**
     * UTC-based: "Minutes Hours Day-of-month Month Day-of-week Year"
     * @see: https://docs.aws.amazon.com/eventbridge/latest/userguide/eb-cron-expressions.html
     * @see: https://docs.aws.amazon.com/lambda/latest/dg/services-cloudwatchevents-expressions.html
     */
    scheduleExpression: ["23 9 * * ? *"], // Every day at 9:23am UTC (1:23am PST)
    url: `http://${props.apiAddress}/internal/db-maintenance`,
    lambdaTimeout: Duration.minutes(5), // How long can the lambda run for, max is 900 seconds (15 minutes)
  };
}

export function createScheduledDBMaintenance(props: EnhancedCoverageConnectorProps): IFunction {
  const config = getConfig();
  const { stack, lambdaLayers, vpc, name, lambdaTimeout, scheduleExpression, url } =
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
      ...(config.lambdasSentryDSN ? { SENTRY_DSN: config.lambdasSentryDSN } : {}),
    },
  });

  return lambda;
}
