import { Alarm, ComparisonOperator, Metric, TreatMissingData } from "aws-cdk-lib/aws-cloudwatch";
import { SnsAction } from "aws-cdk-lib/aws-cloudwatch-actions";
import { Construct } from "constructs";

export function addAlertToMetric({
  scope,
  metric,
  alarmName,
  threshold,
  evaluationPeriods,
  comparisonOperator,
  treatMissingData,
  alertAction,
  includeOkAction = true,
}: {
  scope: Construct;
  metric: Metric;
  alarmName: string;
  threshold: number;
  evaluationPeriods: number;
  comparisonOperator?: ComparisonOperator;
  treatMissingData?: TreatMissingData;
  alertAction?: SnsAction;
  includeOkAction?: boolean;
}): Alarm {
  const alarm = metric.createAlarm(scope, alarmName, {
    threshold,
    evaluationPeriods,
    comparisonOperator,
    treatMissingData,
  });
  alertAction && alarm.addAlarmAction(alertAction);
  alertAction && includeOkAction && alarm.addOkAction(alertAction);
  return alarm;
}
