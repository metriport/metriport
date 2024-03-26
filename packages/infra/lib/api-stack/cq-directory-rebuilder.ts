import { Duration } from "aws-cdk-lib";
import { SnsAction } from "aws-cdk-lib/aws-cloudwatch-actions";
import { IVpc } from "aws-cdk-lib/aws-ec2";
import { Function as Lambda } from "aws-cdk-lib/aws-lambda";
import { Construct } from "constructs";
import { EnvConfig } from "../../config/env-config";
import { getConfig } from "../shared/config";
import { LambdaLayers } from "../shared/lambda-layers";
import { createScheduledLambda } from "../shared/lambda-scheduled";

export type CqDirectoryRebuilderProps = {
  stack: Construct;
  lambdaLayers: LambdaLayers;
  vpc: IVpc;
  apiAddress: string;
  alarmSnsAction?: SnsAction;
};

function getSettings(
  props: CqDirectoryRebuilderProps,
  config: NonNullable<EnvConfig["cqDirectoryRebuilder"]>
) {
  return {
    ...props,
    name: "ScheduledCqDirectoryRebuilder",
    lambdaMemory: 256,
    lambdaTimeout: Duration.seconds(60), // How long can the lambda run for, max is 900 seconds (15 minutes)
    scheduleExpression: config.scheduleExpressions, // See: https://docs.aws.amazon.com/lambda/latest/dg/services-cloudwatchevents-expressions.html
    url: `http://${props.apiAddress}/internal/carequality/directory/rebuild`,
    httpTimeout: Duration.seconds(5),
  };
}

export function createCqDirectoryRebuilder(props: CqDirectoryRebuilderProps): Lambda | undefined {
  const config = getConfig();
  if (!config.cqDirectoryRebuilder) return;

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
  } = getSettings(props, config.cqDirectoryRebuilder);

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
