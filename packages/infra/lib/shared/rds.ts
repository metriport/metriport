import * as cdk from "aws-cdk-lib";
import * as cloudwatch from "aws-cdk-lib/aws-cloudwatch";
import { SnsAction } from "aws-cdk-lib/aws-cloudwatch-actions";
import * as rds from "aws-cdk-lib/aws-rds";
import { Construct } from "constructs";
import { RDSConfig } from "../../config/aws/rds";
import { mbToBytes } from "../shared/util";
import { addAlarmToMetric } from "./alarm";

const DEFAULT_MIN_LOCAL_STORAGE_MB_ALARM = 10_000;
const DB_CONN_ALARM_THRESHOLD = 0.8;

export function getMaxPostgresConnections(maxAcu: number): number {
  if (maxAcu < 4) return 189;
  if (maxAcu < 8) return 823;
  if (maxAcu < 16) return 1_669;
  if (maxAcu < 32) return 3_360;

  // 32+ ACUs all have 5000 max connections
  return 5_000;
}

export function addDBClusterAlertsAndAlarms({
  scope,
  dbCluster,
  dbClusterName,
  dbConfig,
  alertAction,
  alarmAction,
}: {
  scope: Construct;
  dbCluster: rds.DatabaseCluster;
  dbClusterName: string;
  dbConfig: RDSConfig;
  alertAction?: SnsAction;
  alarmAction: SnsAction;
}) {
  if (!dbConfig.alarmThresholds) return;

  function createAlert({
    name,
    metric,
    threshold,
    evaluationPeriods,
    comparisonOperator,
    treatMissingData,
  }: {
    name: string;
    metric: cloudwatch.Metric;
    threshold: number;
    evaluationPeriods: number;
    comparisonOperator?: cloudwatch.ComparisonOperator;
    treatMissingData?: cloudwatch.TreatMissingData;
  }) {
    const alarm = metric.createAlarm(scope, `${dbClusterName}${name}`, {
      threshold,
      evaluationPeriods,
      comparisonOperator,
      treatMissingData,
    });
    alertAction && alarm.addAlarmAction(alertAction);
    alertAction && alarm.addOkAction(alertAction);
    return alarm;
  }

  createAlert({
    metric: dbCluster.metricFreeableMemory(),
    name: "FreeableMemoryAlarm",
    threshold: mbToBytes(dbConfig.alarmThresholds.freeableMemoryMb),
    evaluationPeriods: 1,
    comparisonOperator: cloudwatch.ComparisonOperator.LESS_THAN_OR_EQUAL_TO_THRESHOLD,
    treatMissingData: cloudwatch.TreatMissingData.NOT_BREACHING,
  });

  createAlert({
    metric: dbCluster.metricCPUUtilization(),
    name: "CPUUtilizationAlarm",
    threshold: dbConfig.alarmThresholds.cpuUtilizationPct,
    evaluationPeriods: 1,
    treatMissingData: cloudwatch.TreatMissingData.NOT_BREACHING,
  });

  createAlert({
    metric: dbCluster.metricVolumeReadIOPs(),
    name: "VolumeReadIOPsAlarm",
    threshold: dbConfig.alarmThresholds.volumeReadIops,
    evaluationPeriods: 1,
    treatMissingData: cloudwatch.TreatMissingData.NOT_BREACHING,
  });

  createAlert({
    metric: dbCluster.metricVolumeWriteIOPs(),
    name: "VolumeWriteIOPsAlarm",
    threshold: dbConfig.alarmThresholds.volumeWriteIops,
    evaluationPeriods: 1,
    treatMissingData: cloudwatch.TreatMissingData.NOT_BREACHING,
  });

  addAlarmToMetric({
    scope,
    metric: dbCluster.metricACUUtilization(),
    name: `${dbClusterName}-ACUUtilization-Alarm`,
    description: `Alarm if ACU utilization is above ${dbConfig.alarmThresholds.acuUtilizationPct}%`,
    threshold: dbConfig.alarmThresholds.acuUtilizationPct,
    comparisonOperator: cloudwatch.ComparisonOperator.GREATER_THAN_OR_EQUAL_TO_THRESHOLD,
    evaluationPeriods: 2,
    alarmSnsAction: alarmAction,
  });

  const thresholdAlarmOpenConnectionsPerDbInstance =
    DB_CONN_ALARM_THRESHOLD * getMaxPostgresConnections(dbConfig.maxCapacity);

  dbCluster.instanceIdentifiers.forEach((instanceId, index) => {
    addAlarmToMetric({
      scope,
      metric: dbCluster.metricDatabaseConnections({
        dimensionsMap: {
          DBInstanceIdentifier: instanceId,
        },
        statistic: "Maximum",
        period: cdk.Duration.minutes(1),
      }),
      name: `${dbClusterName}-DatabaseConnectionsAlarm-${index + 1}`,
      description: `Alarm if the number of open connections is greater than or equal to ${thresholdAlarmOpenConnectionsPerDbInstance}`,
      threshold: thresholdAlarmOpenConnectionsPerDbInstance,
      evaluationPeriods: 3,
      comparisonOperator: cloudwatch.ComparisonOperator.GREATER_THAN_OR_EQUAL_TO_THRESHOLD,
      alarmSnsAction: alarmAction,
    });
  });

  /**
   * For Aurora Serverless, this alarm is not important as it auto-scales. However, we always
   * create this alarm because of compliance controls (SOC2).
   * @see: https://docs.aws.amazon.com/AmazonRDS/latest/AuroraUserGuide/Aurora.Overview.StorageReliability.html#aurora-storage-growth
   */
  createAlert({
    metric: dbCluster.metricFreeLocalStorage(),
    name: "FreeLocalStorageAlarm",
    threshold: mbToBytes(
      dbConfig.alarmThresholds.freeLocalStorageMb ?? DEFAULT_MIN_LOCAL_STORAGE_MB_ALARM
    ),
    evaluationPeriods: 1,
    comparisonOperator: cloudwatch.ComparisonOperator.LESS_THAN_OR_EQUAL_TO_THRESHOLD,
    treatMissingData: cloudwatch.TreatMissingData.NOT_BREACHING,
  });
}
