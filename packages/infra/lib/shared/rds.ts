import * as cdk from "aws-cdk-lib";
import * as cloudwatch from "aws-cdk-lib/aws-cloudwatch";
import { SnsAction } from "aws-cdk-lib/aws-cloudwatch-actions";
import * as rds from "aws-cdk-lib/aws-rds";
import { Construct } from "constructs";
import { EnvConfig } from "../../config/env-config";
import { mbToBytes } from "../shared/util";

const DEFAULT_MIN_LOCAL_STORAGE_MB_ALARM = 10_000;
const DB_CONN_ALARM_THRESHOLD = 0.8;

function getMaxPostgresConnections(maxAcu: number): number {
  if (maxAcu < 4) return 189;
  if (maxAcu < 8) return 823;
  if (maxAcu < 16) return 1_669;
  if (maxAcu < 32) return 3_360;

  // 32+ ACUs all have 5000 max connections
  return 5_000;
}

export function addDBClusterPerformanceAlarms(
  scope: Construct,
  dbCluster: rds.DatabaseCluster,
  dbClusterName: string,
  dbConfig: EnvConfig["apiDatabase"],
  alarmAction?: SnsAction
) {
  if (!dbConfig.alarmThresholds) return;

  const createAlarm = ({
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
  }) => {
    const alarm = metric.createAlarm(scope, `${dbClusterName}${name}`, {
      threshold,
      evaluationPeriods,
      comparisonOperator,
      treatMissingData,
    });
    alarmAction && alarm.addAlarmAction(alarmAction);
    alarmAction && alarm.addOkAction(alarmAction);
    return alarm;
  };

  createAlarm({
    metric: dbCluster.metricFreeableMemory(),
    name: "FreeableMemoryAlarm",
    threshold: mbToBytes(dbConfig.alarmThresholds.freeableMemoryMb),
    evaluationPeriods: 1,
    comparisonOperator: cloudwatch.ComparisonOperator.LESS_THAN_OR_EQUAL_TO_THRESHOLD,
    treatMissingData: cloudwatch.TreatMissingData.NOT_BREACHING,
  });

  createAlarm({
    metric: dbCluster.metricCPUUtilization(),
    name: "CPUUtilizationAlarm",
    threshold: dbConfig.alarmThresholds.cpuUtilizationPct,
    evaluationPeriods: 1,
    treatMissingData: cloudwatch.TreatMissingData.NOT_BREACHING,
  });

  createAlarm({
    metric: dbCluster.metricVolumeReadIOPs(),
    name: "VolumeReadIOPsAlarm",
    threshold: dbConfig.alarmThresholds.volumeReadIops,
    evaluationPeriods: 1,
    treatMissingData: cloudwatch.TreatMissingData.NOT_BREACHING,
  });

  createAlarm({
    metric: dbCluster.metricVolumeWriteIOPs(),
    name: "VolumeWriteIOPsAlarm",
    threshold: dbConfig.alarmThresholds.volumeWriteIops,
    evaluationPeriods: 1,
    treatMissingData: cloudwatch.TreatMissingData.NOT_BREACHING,
  });

  createAlarm({
    metric: dbCluster.metricACUUtilization(),
    name: "ACUUtilizationAlarm",
    threshold: dbConfig.alarmThresholds.acuUtilizationPct,
    evaluationPeriods: 2,
    treatMissingData: cloudwatch.TreatMissingData.NOT_BREACHING,
  });

  const maxConnectionsPerInstance =
    DB_CONN_ALARM_THRESHOLD * getMaxPostgresConnections(dbConfig.maxCapacity);

  dbCluster.instanceIdentifiers.forEach((instanceId, index) => {
    createAlarm({
      metric: dbCluster.metricDatabaseConnections({
        dimensionsMap: {
          DBInstanceIdentifier: instanceId,
        },
        statistic: "Maximum",
        period: cdk.Duration.minutes(1),
      }),
      name: `DatabaseConnectionsAlarm-${index + 1}`,
      threshold: maxConnectionsPerInstance,
      evaluationPeriods: 2,
      comparisonOperator: cloudwatch.ComparisonOperator.GREATER_THAN_OR_EQUAL_TO_THRESHOLD,
      treatMissingData: cloudwatch.TreatMissingData.NOT_BREACHING,
    });
  });

  /**
   * For Aurora Serverless, this alarm is not important as it auto-scales. However, we always
   * create this alarm because of compliance controls (SOC2).
   * @see: https://docs.aws.amazon.com/AmazonRDS/latest/AuroraUserGuide/Aurora.Overview.StorageReliability.html#aurora-storage-growth
   */
  createAlarm({
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
