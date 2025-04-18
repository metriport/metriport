import { Duration, NestedStack, NestedStackProps } from "aws-cdk-lib";
import * as cloudwatch from "aws-cdk-lib/aws-cloudwatch";
import { SnsAction } from "aws-cdk-lib/aws-cloudwatch-actions";
import * as dynamodb from "aws-cdk-lib/aws-dynamodb";
import { Construct } from "constructs";
import { EnvConfig } from "../config/env-config";
import { isProd } from "./shared/util";

interface FeatureFlagsNestedStackProps extends NestedStackProps {
  config: EnvConfig;
  alarmAction?: SnsAction;
}

function getSettings(props: FeatureFlagsNestedStackProps) {
  return {
    ...props,
    dynamoConstructName: "FeatureFlags",
    dynamoPartitionKey: "id",
    dynamoPartitionType: dynamodb.AttributeType.STRING,
    dynamoSortKey: "version",
    dynamoSortType: dynamodb.AttributeType.NUMBER,
    dynamoReplicationRegions: isProd(props.config) ? ["us-east-1"] : ["ca-central-1"],
    dynamoReplicationTimeout: Duration.hours(3),
    dynamoPointInTimeRecovery: true,
    // BOTH: https://docs.aws.amazon.com/amazondynamodb/latest/developerguide/on-demand-capacity-mode.html
    // Starts w/ 4,000 writes/s
    // Also see: https://docs.aws.amazon.com/amazondynamodb/latest/developerguide/metrics-dimensions.html#ConsumedWriteCapacityUnits
    consumedWriteCapacityUnitsAlarmThreshold: isProd(props.config) ? 200_000 : 50_000,
    consumedWriteCapacityUnitsAlarmPeriod: 1,
    // Starts w/ 12,000 reads/s
    // Also see: https://docs.aws.amazon.com/amazondynamodb/latest/developerguide/metrics-dimensions.html#ConsumedReadCapacityUnits
    consumedReadCapacityUnitsAlarmThreshold: isProd(props.config) ? 600_000 : 150_000,
    consumedReadCapacityUnitsAlarmPeriod: 2,
  };
}

export class FeatureFlagsNestedStack extends NestedStack {
  readonly featureFlagsTable: dynamodb.Table;

  constructor(scope: Construct, id: string, props: FeatureFlagsNestedStackProps) {
    super(scope, id, props);
    this.featureFlagsTable = this.setupFeatureFlagsTable(getSettings(props));
  }

  private setupFeatureFlagsTable(ownProps: {
    dynamoConstructName: string;
    dynamoPartitionKey: string;
    dynamoPartitionType: dynamodb.AttributeType;
    dynamoSortKey: string;
    dynamoSortType: dynamodb.AttributeType;
    dynamoReplicationRegions: string[];
    dynamoReplicationTimeout: Duration;
    dynamoPointInTimeRecovery: boolean;
    alarmAction?: SnsAction;
    consumedWriteCapacityUnitsAlarmThreshold: number;
    consumedWriteCapacityUnitsAlarmPeriod: number;
    consumedReadCapacityUnitsAlarmThreshold: number;
    consumedReadCapacityUnitsAlarmPeriod: number;
  }): dynamodb.Table {
    const {
      dynamoConstructName,
      dynamoPartitionKey,
      dynamoPartitionType,
      dynamoSortKey,
      dynamoSortType,
      dynamoReplicationRegions,
      dynamoReplicationTimeout,
      dynamoPointInTimeRecovery,
      alarmAction,
      consumedWriteCapacityUnitsAlarmThreshold,
      consumedWriteCapacityUnitsAlarmPeriod,
      consumedReadCapacityUnitsAlarmThreshold,
      consumedReadCapacityUnitsAlarmPeriod,
    } = ownProps;
    const table = new dynamodb.Table(this, dynamoConstructName, {
      partitionKey: {
        name: dynamoPartitionKey,
        type: dynamoPartitionType,
      },
      sortKey: {
        name: dynamoSortKey,
        type: dynamoSortType,
      },
      replicationRegions: dynamoReplicationRegions,
      replicationTimeout: dynamoReplicationTimeout,
      encryption: dynamodb.TableEncryption.AWS_MANAGED,
      pointInTimeRecovery: dynamoPointInTimeRecovery,
    });
    // TODO: note that the pointInTimeRecovery (PITR) setting does not persist
    // through to the replica tables.
    //
    // See this CDK issue: https://github.com/aws/aws-cdk/issues/18582
    //
    // For future DDB tables, can potentailly use this is a workaround:
    // https://stackoverflow.com/questions/70687039/how-to-set-point-in-time-recovery-on-a-dynamodb-replica
    //
    // For now, we will manually enable PITR on replicas in the console.
    // add performance alarms for monitoring prod environment
    this.addDynamoPerformanceAlarms({
      table,
      dynamoConstructName,
      consumedWriteCapacityUnitsAlarmThreshold,
      consumedWriteCapacityUnitsAlarmPeriod,
      consumedReadCapacityUnitsAlarmThreshold,
      consumedReadCapacityUnitsAlarmPeriod,
      alarmAction,
    });
    return table;
  }

  private addDynamoPerformanceAlarms({
    table,
    dynamoConstructName,
    consumedWriteCapacityUnitsAlarmThreshold,
    consumedWriteCapacityUnitsAlarmPeriod,
    consumedReadCapacityUnitsAlarmThreshold,
    consumedReadCapacityUnitsAlarmPeriod,
    alarmAction,
  }: {
    table: dynamodb.Table;
    dynamoConstructName: string;
    consumedWriteCapacityUnitsAlarmThreshold: number;
    consumedWriteCapacityUnitsAlarmPeriod: number;
    consumedReadCapacityUnitsAlarmThreshold: number;
    consumedReadCapacityUnitsAlarmPeriod: number;
    alarmAction?: SnsAction;
  }) {
    const readUnitsMetric = table.metricConsumedReadCapacityUnits();
    const readAlarm = readUnitsMetric.createAlarm(
      this,
      `${dynamoConstructName}ConsumedReadCapacityUnitsAlarm`,
      {
        threshold: consumedReadCapacityUnitsAlarmThreshold, // units per second
        evaluationPeriods: consumedReadCapacityUnitsAlarmPeriod,
        treatMissingData: cloudwatch.TreatMissingData.NOT_BREACHING,
      }
    );
    alarmAction && readAlarm.addAlarmAction(alarmAction);
    alarmAction && readAlarm.addOkAction(alarmAction);

    const writeUnitsMetric = table.metricConsumedWriteCapacityUnits();
    const writeAlarm = writeUnitsMetric.createAlarm(
      this,
      `${dynamoConstructName}ConsumedWriteCapacityUnitsAlarm`,
      {
        threshold: consumedWriteCapacityUnitsAlarmThreshold, // units per second
        evaluationPeriods: consumedWriteCapacityUnitsAlarmPeriod,
        treatMissingData: cloudwatch.TreatMissingData.NOT_BREACHING,
      }
    );
    alarmAction && writeAlarm.addAlarmAction(alarmAction);
    alarmAction && writeAlarm.addOkAction(alarmAction);
  }
}
