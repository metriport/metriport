import { Duration } from "aws-cdk-lib";
import { SnsAction } from "aws-cdk-lib/aws-cloudwatch-actions";
import { IVpc } from "aws-cdk-lib/aws-ec2";
import { Function as Lambda } from "aws-cdk-lib/aws-lambda";
import { Construct } from "constructs";
import { EnvConfig } from "../../config/env-config";
import { getConfig } from "../shared/config";
import { LambdaLayers } from "../shared/lambda-layers";
import { createScheduledLambda } from "../shared/lambda-scheduled";

export type EhexDirectoryRebuilderProps = {
  stack: Construct;
  lambdaLayers: LambdaLayers;
  vpc: IVpc;
  alertSnsAction?: SnsAction;
};

function getSettings(
  props: EhexDirectoryRebuilderProps,
  config: NonNullable<EnvConfig["ehexDirectoryRebuilder"]>,
  apiUrl: string
) {
  return {
    ...props,
    name: "ScheduledEhexDirectoryRebuilder",
    lambdaMemory: 128,
    lambdaTimeout: Duration.seconds(30), // How long can the lambda run for, max is 900 seconds (15 minutes)
    scheduleExpression: config.scheduleExpressions, // See: https://docs.aws.amazon.com/lambda/latest/dg/services-cloudwatchevents-expressions.html
    url: `${apiUrl}/internal/ehex/directory/rebuild`,
    httpTimeout: Duration.seconds(5),
  };
}

export function createEhexDirectoryRebuilder(
  props: EhexDirectoryRebuilderProps
): Lambda | undefined {
  const config = getConfig();
  if (!config.ehexDirectoryRebuilder) return;

  const {
    stack,
    lambdaLayers,
    vpc,
    alertSnsAction,
    name,
    lambdaMemory,
    lambdaTimeout,
    scheduleExpression,
    url,
    httpTimeout,
  } = getSettings(props, config.ehexDirectoryRebuilder, config.loadBalancerDnsName);

  const lambda = createScheduledLambda({
    stack,
    layers: [lambdaLayers.shared],
    name,
    vpc,
    scheduleExpression,
    url,
    memory: lambdaMemory,
    timeout: lambdaTimeout,
    alertSnsAction,
    envType: config.environmentType,
    envVars: {
      TIMEOUT_MILLIS: String(httpTimeout.toMilliseconds()),
      ...(config.lambdasSentryDSN ? { SENTRY_DSN: config.lambdasSentryDSN } : {}),
    },
  });

  return lambda;
}
