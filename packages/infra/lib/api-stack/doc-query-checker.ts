import { Duration } from "aws-cdk-lib";
import { SnsAction } from "aws-cdk-lib/aws-cloudwatch-actions";
import { IVpc } from "aws-cdk-lib/aws-ec2";
import { Function as Lambda, Runtime } from "aws-cdk-lib/aws-lambda";
import { Construct } from "constructs";
import { EnvConfig } from "../../config/env-config";
import { getConfig } from "../shared/config";
import { LambdaLayers } from "../shared/lambda-layers";
import { createScheduledLambda } from "../shared/lambda-scheduled";

export type DocQueryCheckerProps = {
  stack: Construct;
  lambdaLayers: LambdaLayers;
  vpc: IVpc;
  apiAddress: string;
  alarmSnsAction?: SnsAction;
};

function getSettings(
  props: DocQueryCheckerProps,
  config: NonNullable<EnvConfig["docQueryChecker"]>
) {
  return {
    ...props,
    name: "ScheduledDocumentQueryChecker",
    lambdaMemory: 256,
    lambdaTimeout: Duration.seconds(100), // How long can the lambda run for, max is 900 seconds (15 minutes)
    runtime: Runtime.NODEJS_18_X,
    scheduleExpression: config.scheduleExpressions, // See: https://docs.aws.amazon.com/lambda/latest/dg/services-cloudwatchevents-expressions.html
    url: `http://${props.apiAddress}/internal/docs/check-doc-queries`,
    httpTimeout: Duration.seconds(3),
  };
}

export function createDocQueryChecker(props: DocQueryCheckerProps): Lambda | undefined {
  const config = getConfig();
  if (!config.docQueryChecker) return;

  const {
    stack,
    lambdaLayers,
    vpc,
    runtime,
    alarmSnsAction,
    name,
    lambdaMemory,
    lambdaTimeout,
    scheduleExpression,
    url,
    httpTimeout,
  } = getSettings(props, config.docQueryChecker);

  const lambda = createScheduledLambda({
    stack,
    layers: [lambdaLayers.shared],
    name,
    vpc,
    scheduleExpression,
    url,
    runtime,
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
