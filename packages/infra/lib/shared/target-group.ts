import { Duration } from "aws-cdk-lib";
import { ComparisonOperator, TreatMissingData } from "aws-cdk-lib/aws-cloudwatch";
import { SnsAction } from "aws-cdk-lib/aws-cloudwatch-actions";
import { ApplicationTargetGroup, HttpCodeTarget } from "aws-cdk-lib/aws-elasticloadbalancingv2";
import { Construct } from "constructs";
import { addAlarmToMetric } from "../shared/cloudwatch-metric";

export function addDefaultMetricsToTargetGroup({
  targetGroup,
  scope,
  id,
  idx = 0,
  alarmAction,
}: {
  targetGroup: ApplicationTargetGroup;
  scope: Construct;
  id: string;
  idx?: number;
  alarmAction?: SnsAction;
}) {
  const name = `${id}_TargetGroup${idx}`;
  addAlarmToMetric({
    scope,
    metric: targetGroup.metrics.unhealthyHostCount(),
    alarmName: `${name}_UnhealthyRequestCount`,
    threshold: 1,
    evaluationPeriods: 1,
    comparisonOperator: ComparisonOperator.GREATER_THAN_OR_EQUAL_TO_THRESHOLD,
    treatMissingData: TreatMissingData.NOT_BREACHING,
    alarmAction,
  });
  addAlarmToMetric({
    scope,
    metric: targetGroup.metrics.targetResponseTime(),
    alarmName: `${name}_TargetResponseTime`,
    threshold: Duration.seconds(29).toSeconds(),
    evaluationPeriods: 1,
    comparisonOperator: ComparisonOperator.GREATER_THAN_OR_EQUAL_TO_THRESHOLD,
    treatMissingData: TreatMissingData.NOT_BREACHING,
    alarmAction,
  });
  addAlarmToMetric({
    scope,
    metric: targetGroup.metrics.httpCodeTarget(HttpCodeTarget.TARGET_5XX_COUNT),
    alarmName: `${name}_Target5xxCount`,
    threshold: 5,
    evaluationPeriods: 1,
    comparisonOperator: ComparisonOperator.GREATER_THAN_OR_EQUAL_TO_THRESHOLD,
    treatMissingData: TreatMissingData.NOT_BREACHING,
    alarmAction,
  });
}
