import * as lambda from "aws-cdk-lib/aws-lambda";
import * as lambda_node from "aws-cdk-lib/aws-lambda-nodejs";
import { Duration } from "aws-cdk-lib";
import { Construct } from "constructs";

export function addErrorAlarmToLambdaFunc(
  construct: Construct,
  lambdaFunc: lambda.SingletonFunction | lambda_node.NodejsFunction,
  alarmName: string
) {
  const errMetric = lambdaFunc.metricErrors({
    period: Duration.minutes(1),
  });
  // 👇 create an Alarm directly on the Metric
  errMetric.createAlarm(construct, alarmName, {
    threshold: 1,
    evaluationPeriods: 1,
    alarmDescription:
      "Alarm if the SUM of Lambda invocations is greater than or equal to the  threshold (1) for 1 evaluation period",
  });
}
