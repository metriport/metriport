import * as cloudwatch from "aws-cdk-lib/aws-cloudwatch";
import { SnsAction } from "aws-cdk-lib/aws-cloudwatch-actions";
import * as rds from "aws-cdk-lib/aws-rds";
import { Construct } from "constructs";
import { RDSAlarmThresholds } from "../../config/aws/rds";
import { mbToBytes } from "../shared/util";

const DEFAULT_MIN_LOCAL_STORAGE_MB_ALARM = 10_000;

export function addDBClusterPerformanceAlarms(
  scope: Construct,
  dbCluster: rds.DatabaseCluster,
  dbClusterName: string,
  thresholds?: RDSAlarmThresholds,
  alarmAction?: SnsAction
) {
  if (!thresholds) return;
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
    threshold: mbToBytes(thresholds.freeableMemoryMb),
    evaluationPeriods: 1,
    comparisonOperator: cloudwatch.ComparisonOperator.LESS_THAN_OR_EQUAL_TO_THRESHOLD,
    treatMissingData: cloudwatch.TreatMissingData.NOT_BREACHING,
  });

  createAlarm({
    metric: dbCluster.metricCPUUtilization(),
    name: "CPUUtilizationAlarm",
    threshold: thresholds.cpuUtilizationPct,
    evaluationPeriods: 1,
    treatMissingData: cloudwatch.TreatMissingData.NOT_BREACHING,
  });

  createAlarm({
    metric: dbCluster.metricVolumeReadIOPs(),
    name: "VolumeReadIOPsAlarm",
    threshold: thresholds.volumeReadIops,
    evaluationPeriods: 1,
    treatMissingData: cloudwatch.TreatMissingData.NOT_BREACHING,
  });

  createAlarm({
    metric: dbCluster.metricVolumeWriteIOPs(),
    name: "VolumeWriteIOPsAlarm",
    threshold: thresholds.volumeWriteIops,
    evaluationPeriods: 1,
    treatMissingData: cloudwatch.TreatMissingData.NOT_BREACHING,
  });

  createAlarm({
    metric: dbCluster.metricACUUtilization(),
    name: "ACUUtilizationAlarm",
    threshold: thresholds.acuUtilizationPct,
    evaluationPeriods: 1,
    treatMissingData: cloudwatch.TreatMissingData.NOT_BREACHING,
  });

  /**
   * For Aurora Serverless, this alarm is not important as it auto-scales. However, we always
   * create this alarm because of compliance controls (SOC2).
   * @see: https://docs.aws.amazon.com/AmazonRDS/latest/AuroraUserGuide/Aurora.Overview.StorageReliability.html#aurora-storage-growth
   */
  createAlarm({
    metric: dbCluster.metricFreeLocalStorage(),
    name: "FreeLocalStorageAlarm",
    threshold: mbToBytes(thresholds.freeLocalStorageMb ?? DEFAULT_MIN_LOCAL_STORAGE_MB_ALARM),
    evaluationPeriods: 1,
    comparisonOperator: cloudwatch.ComparisonOperator.LESS_THAN_OR_EQUAL_TO_THRESHOLD,
    treatMissingData: cloudwatch.TreatMissingData.NOT_BREACHING,
  });
}
