import { Duration } from "aws-cdk-lib";
import * as cloudwatch from "aws-cdk-lib/aws-cloudwatch";
import { SnsAction } from "aws-cdk-lib/aws-cloudwatch-actions";
import * as lambda from "aws-cdk-lib/aws-lambda";
import * as lambda_node from "aws-cdk-lib/aws-lambda-nodejs";
import { Construct } from "constructs";
import { EnvConfig } from "./env-config";
import { EnvType } from "./env-type";

export function isProd(config: EnvConfig): boolean {
  return config.environmentType === EnvType.production;
}

export function isSandbox(config: EnvConfig): boolean {
  return config.environmentType === EnvType.sandbox;
}

export function addErrorAlarmToLambdaFunc(
  construct: Construct,
  lambdaFunc: lambda.SingletonFunction | lambda_node.NodejsFunction,
  alarmName: string,
  alarmAction?: SnsAction
) {
  const errMetric = lambdaFunc.metricErrors({
    period: Duration.minutes(1),
  });
  // 👇 create an Alarm directly on the Metric
  const alarm = errMetric.createAlarm(construct, alarmName, {
    threshold: 1,
    evaluationPeriods: 1,
    alarmDescription:
      "Alarm if the SUM of Lambda invocations is greater than or equal to the  threshold (1) for 1 evaluation period",
    treatMissingData: cloudwatch.TreatMissingData.NOT_BREACHING,
  });
  alarmAction && alarm.addAlarmAction(alarmAction);
}

export function mbToBytes(mb: number): number {
  return mb * 1024 * 1024;
}

export function getEnvVar(varName: string): string | undefined {
  return process.env[varName];
}
export function getEnvVarOrFail(varName: string): string {
  const value = getEnvVar(varName);
  if (!value || value.trim().length < 1) {
    throw new Error(`Missing ${varName} env var`);
  }
  return value;
}
