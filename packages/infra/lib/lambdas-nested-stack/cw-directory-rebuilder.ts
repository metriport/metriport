import { Duration } from "aws-cdk-lib";
import { SnsAction } from "aws-cdk-lib/aws-cloudwatch-actions";
import { IVpc } from "aws-cdk-lib/aws-ec2";
import { Function as Lambda } from "aws-cdk-lib/aws-lambda";
import { Construct } from "constructs";
import { EnvConfig } from "../../config/env-config";
import { getConfig } from "../shared/config";
import { LambdaLayers } from "../shared/lambda-layers";
import { createScheduledLambda } from "../shared/lambda-scheduled";

export type CwDirectoryRebuilderProps = {
  stack: Construct;
  lambdaLayers: LambdaLayers;
  vpc: IVpc;
  alarmSnsAction?: SnsAction;
};

function getSettings(
  props: CwDirectoryRebuilderProps,
  config: NonNullable<EnvConfig["cwDirectoryRebuilder"]>,
  apiUrl: string
) {
  return {
    ...props,
    name: "ScheduledCwDirectoryRebuilder",
    lambdaMemory: 128,
    lambdaTimeout: Duration.seconds(30), // How long can the lambda run for, max is 900 seconds (15 minutes)
    scheduleExpression: config.scheduleExpressions, // See: https://docs.aws.amazon.com/lambda/latest/dg/services-cloudwatchevents-expressions.html
    url: `http://${apiUrl}/internal/commonwell/directory/rebuild`,
    httpTimeout: Duration.seconds(5),
  };
}

export function createCwDirectoryRebuilder(props: CwDirectoryRebuilderProps): Lambda | undefined {
  const config = getConfig();
  if (!config.cwDirectoryRebuilder) return;

  const {
    stack,
    lambdaLayers,
    vpc,
    alarmSnsAction,
    name,
    lambdaMemory,
    lambdaTimeout,
    scheduleExpression,
    url,
    httpTimeout,
  } = getSettings(props, config.cwDirectoryRebuilder, config.loadBalancerDnsName);

  const lambda = createScheduledLambda({
    stack,
    layers: [lambdaLayers.shared],
    name,
    vpc,
    scheduleExpression,
    url,
    memory: lambdaMemory,
    timeout: lambdaTimeout,
    alarmSnsAction,
    envType: config.environmentType,
    envVars: {
      TIMEOUT_MILLIS: String(httpTimeout.toMilliseconds()),
      ...(config.lambdasSentryDSN ? { SENTRY_DSN: config.lambdasSentryDSN } : {}),
    },
  });

  return lambda;
}
