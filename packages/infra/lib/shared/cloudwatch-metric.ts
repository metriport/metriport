import { Alarm, ComparisonOperator, Metric, TreatMissingData } from "aws-cdk-lib/aws-cloudwatch";
import { SnsAction } from "aws-cdk-lib/aws-cloudwatch-actions";
import { Construct } from "constructs";

export function addAlarmToMetric({
  scope,
  metric,
  alarmName,
  threshold,
  evaluationPeriods,
  comparisonOperator,
  treatMissingData,
  alarmAction,
  includeOkAction = true,
}: {
  scope: Construct;
  metric: Metric;
  alarmName: string;
  threshold: number;
  evaluationPeriods: number;
  comparisonOperator?: ComparisonOperator;
  treatMissingData?: TreatMissingData;
  alarmAction?: SnsAction;
  includeOkAction?: boolean;
}): Alarm {
  const alarm = metric.createAlarm(scope, alarmName, {
    threshold,
    evaluationPeriods,
    comparisonOperator,
    treatMissingData,
  });
  alarmAction && alarm.addAlarmAction(alarmAction);
  alarmAction && includeOkAction && alarm.addOkAction(alarmAction);
  return alarm;
}
