import { Duration } from "aws-cdk-lib";
import { SnsAction } from "aws-cdk-lib/aws-cloudwatch-actions";
import { IVpc } from "aws-cdk-lib/aws-ec2";
import { Function as Lambda, Runtime } from "aws-cdk-lib/aws-lambda";
import { Construct } from "constructs";
import { EnvConfig } from "../env-config";
import { getConfig } from "../shared/config";
import { createScheduledLambda } from "../shared/lambda-scheduled";

export type ConversionCheckerProps = {
  stack: Construct;
  vpc: IVpc;
  apiAddress: string;
  alarmSnsAction?: SnsAction;
};

function settings(
  props: ConversionCheckerProps,
  config: NonNullable<EnvConfig["fhirConversionChecker"]>
) {
  return {
    ...props,
    name: "FHIRConversionChecker",
    lambdaMemory: 256,
    lambdaTimeout: Duration.seconds(100), // How long can the lambda run for, max is 900 seconds (15 minutes)
    runtime: Runtime.NODEJS_18_X,
    scheduleExpression: config.scheduleExpressions, // See: https://docs.aws.amazon.com/lambda/latest/dg/services-cloudwatchevents-expressions.html
    url: "http://" + props.apiAddress + "/internal/docs/check-conversions",
    httpTimeoutMillis: 3_000,
  };
}

export function createConversionChecker(props: ConversionCheckerProps): Lambda | undefined {
  const config = getConfig();
  if (!config.fhirConversionChecker) return;

  const {
    stack,
    vpc,
    runtime,
    apiAddress,
    alarmSnsAction,
    name,
    lambdaMemory,
    lambdaTimeout,
    scheduleExpression,
    url,
    httpTimeoutMillis,
  } = settings(props, config.fhirConversionChecker);

  const lambda = createScheduledLambda({
    stack,
    name,
    vpc,
    scheduleExpression,
    url: apiAddress,
    runtime,
    memory: lambdaMemory,
    timeout: lambdaTimeout,
    alarmSnsAction,
    envVars: {
      URL: url,
      TIMEOUT_MILLIS: String(httpTimeoutMillis),
      ENV_TYPE: config.environmentType,
      ...(config.lambdasSentryDSN ? { SENTRY_DSN: config.lambdasSentryDSN } : {}),
    },
  });

  return lambda;
}
