import { Duration } from "aws-cdk-lib";
import { SnsAction } from "aws-cdk-lib/aws-cloudwatch-actions";
import { IVpc } from "aws-cdk-lib/aws-ec2";
import { Function as Lambda, Runtime } from "aws-cdk-lib/aws-lambda";
import { Construct } from "constructs";
import { EnvConfig } from "../env-config";
import { getConfig } from "../shared/config";
import { createScheduledLambda } from "../shared/lambda-scheduled";

function settings(config: NonNullable<EnvConfig["fhirConversionChecker"]>) {
  return {
    name: "FHIRConversionChecker",
    lambdaMemory: 256,
    // How long can the lambda run for, max is 900 seconds (15 minutes)
    lambdaTimeout: Duration.seconds(100),
    // "Minutes Hours Day-of-month Month Day-of-week Year"
    // See more here: https://docs.aws.amazon.com/lambda/latest/dg/services-cloudwatchevents-expressions.html
    scheduleExpression: config.scheduleExpressions,
    urlPath: "/internal/docs/check-conversions",
  };
}

export function createConversionChecker({
  stack,
  vpc,
  url,
  alarmSnsAction,
}: {
  stack: Construct;
  vpc: IVpc;
  url: string;
  alarmSnsAction?: SnsAction;
}): Lambda | undefined {
  const config = getConfig();
  if (!config.fhirConversionChecker) return;

  const { name, lambdaMemory, lambdaTimeout, scheduleExpression, urlPath } = settings(
    config.fhirConversionChecker
  );

  const lambda = createScheduledLambda({
    stack,
    name,
    vpc,
    scheduleExpression,
    url,
    runtime: Runtime.NODEJS_18_X,
    memory: lambdaMemory,
    timeout: lambdaTimeout,
    alarmSnsAction,
    envVars: {
      URL: url + urlPath,
      ENV_TYPE: config.environmentType,
      ...(config.lambdasSentryDSN ? { SENTRY_DSN: config.lambdasSentryDSN } : {}),
    },
  });

  return lambda;
}
