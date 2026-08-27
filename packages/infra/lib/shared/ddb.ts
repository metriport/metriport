import * as cloudwatch from "aws-cdk-lib/aws-cloudwatch";
import { SnsAction } from "aws-cdk-lib/aws-cloudwatch-actions";
import * as dynamodb from "aws-cdk-lib/aws-dynamodb";
import { Construct } from "constructs";

const defaultThreshold = 10_000;
const defaultEvaluationPeriods = 1;

export function addDynamoPerformanceAlerts({
  scope,
  table,
  dynamoConstructName,
  consumedReadCapacityUnitsAlertThreshold = defaultThreshold,
  consumedReadCapacityUnitsAlertPeriod = defaultEvaluationPeriods,
  consumedWriteCapacityUnitsAlertThreshold = defaultThreshold,
  consumedWriteCapacityUnitsAlertPeriod = defaultEvaluationPeriods,
  alertAction,
}: {
  scope: Construct;
  table: dynamodb.Table;
  dynamoConstructName: string;
  consumedReadCapacityUnitsAlertThreshold?: number;
  consumedReadCapacityUnitsAlertPeriod?: number;
  consumedWriteCapacityUnitsAlertThreshold?: number;
  consumedWriteCapacityUnitsAlertPeriod?: number;
  alertAction?: SnsAction;
}): void {
  const readUnitsMetric = table.metricConsumedReadCapacityUnits();
  const readAlarm = readUnitsMetric.createAlarm(
    scope,
    `${dynamoConstructName}ConsumedReadCapacityUnitsAlarm`,
    {
      threshold: consumedReadCapacityUnitsAlertThreshold,
      evaluationPeriods: consumedReadCapacityUnitsAlertPeriod,
      treatMissingData: cloudwatch.TreatMissingData.NOT_BREACHING,
    }
  );
  if (alertAction) {
    readAlarm.addAlarmAction(alertAction);
    readAlarm.addOkAction(alertAction);
  }

  const writeUnitsMetric = table.metricConsumedWriteCapacityUnits();
  const writeAlarm = writeUnitsMetric.createAlarm(
    scope,
    `${dynamoConstructName}ConsumedWriteCapacityUnitsAlarm`,
    {
      threshold: consumedWriteCapacityUnitsAlertThreshold,
      evaluationPeriods: consumedWriteCapacityUnitsAlertPeriod,
      treatMissingData: cloudwatch.TreatMissingData.NOT_BREACHING,
    }
  );
  if (alertAction) {
    writeAlarm.addAlarmAction(alertAction);
    writeAlarm.addOkAction(alertAction);
  }
}
