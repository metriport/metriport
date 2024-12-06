import { Duration, NestedStack, NestedStackProps } from "aws-cdk-lib";
import { SnsAction } from "aws-cdk-lib/aws-cloudwatch-actions";
import * as dynamodb from "aws-cdk-lib/aws-dynamodb";
import * as cloudwatch from "aws-cdk-lib/aws-cloudwatch";
import { Construct } from "constructs";
import { EnvConfig } from "../config/env-config";
import { isProd } from "./shared/util";

interface RateLimitingNestedStackProps extends NestedStackProps {
  config: EnvConfig;
  alarmAction?: SnsAction;
}

function getSettings(props: RateLimitingNestedStackProps) {
  return {
    ...props,
    dynamoConstructName: "APIRateLimit",
    dynamoRateLimitPartitionKey: "cxIdAndOperationAndWindow",
    dynamoReplicationRegions: isProd(props.config) ? ["us-east-1"] : ["ca-central-1"],
    dynamoReplicationTimeout: Duration.hours(3),
    dynamoPointInTimeRecovery: true,
    consumedWriteCapacityUnitsAlarmThreshold: isProd(props.config) ? 5000 : 100,
    consumedWriteCapacityUnitsAlarmPeriod: 1,
    consumedReadCapacityUnitsAlarmThreshold: isProd(props.config) ? 5000 : 100,
    consumedReadCapacityUnitsAlarmPeriod: 1,
  };
}

export class RateLimitingNestedStack extends NestedStack {
  readonly rateLimitTable: dynamodb.Table;

  constructor(scope: Construct, id: string, props: RateLimitingNestedStackProps) {
    super(scope, id, props);

    const {
      alarmAction,
      dynamoConstructName,
      dynamoRateLimitPartitionKey,
      dynamoReplicationRegions,
      dynamoReplicationTimeout,
      dynamoPointInTimeRecovery,
      consumedWriteCapacityUnitsAlarmThreshold,
      consumedWriteCapacityUnitsAlarmPeriod,
      consumedReadCapacityUnitsAlarmThreshold,
      consumedReadCapacityUnitsAlarmPeriod,
    } = getSettings(props);

    this.rateLimitTable = this.setupRateLimitTable({
      dynamoConstructName,
      dynamoRateLimitPartitionKey,
      dynamoReplicationRegions,
      dynamoReplicationTimeout,
      dynamoPointInTimeRecovery,
      alarmAction,
      consumedWriteCapacityUnitsAlarmThreshold,
      consumedWriteCapacityUnitsAlarmPeriod,
      consumedReadCapacityUnitsAlarmThreshold,
      consumedReadCapacityUnitsAlarmPeriod,
    });
  }

  private setupRateLimitTable(ownProps: {
    dynamoConstructName: string;
    dynamoRateLimitPartitionKey: string;
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
      dynamoRateLimitPartitionKey,
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
        name: dynamoRateLimitPartitionKey,
        type: dynamodb.AttributeType.STRING,
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
        threshold: consumedWriteCapacityUnitsAlarmThreshold, // units per second
        evaluationPeriods: consumedWriteCapacityUnitsAlarmPeriod,
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
        threshold: consumedReadCapacityUnitsAlarmThreshold, // units per second
        evaluationPeriods: consumedReadCapacityUnitsAlarmPeriod,
        treatMissingData: cloudwatch.TreatMissingData.NOT_BREACHING,
      }
    );
    alarmAction && writeAlarm.addAlarmAction(alarmAction);
    alarmAction && writeAlarm.addOkAction(alarmAction);
  }
}
