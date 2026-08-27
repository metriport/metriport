import { Duration, NestedStack, NestedStackProps } from "aws-cdk-lib";
import { SnsAction } from "aws-cdk-lib/aws-cloudwatch-actions";
import * as dynamodb from "aws-cdk-lib/aws-dynamodb";
import { Construct } from "constructs";
import { EnvConfig } from "../config/env-config";
import { addDynamoPerformanceAlerts } from "./shared/ddb";
import { isProd } from "./shared/util";

interface RateLimitingNestedStackProps extends NestedStackProps {
  config: EnvConfig;
  alertAction?: SnsAction;
}

function getSettings(props: RateLimitingNestedStackProps) {
  return {
    ...props,
    dynamoConstructName: "APIRateLimit",
    dynamoRateLimitPartitionKey: "cxIdAndOperationAndWindow",
    dynamoReplicationRegions: isProd(props.config) ? ["us-east-1"] : ["ca-central-1"],
    dynamoReplicationTimeout: Duration.hours(3),
    dynamoPointInTimeRecovery: true,
    consumedWriteCapacityUnitsAlertThreshold: isProd(props.config) ? 5000 : 100,
    consumedWriteCapacityUnitsAlertPeriod: 1,
    consumedReadCapacityUnitsAlertThreshold: isProd(props.config) ? 5000 : 100,
    consumedReadCapacityUnitsAlertPeriod: 1,
  };
}

export class RateLimitingNestedStack extends NestedStack {
  readonly rateLimitTable: dynamodb.Table;
  readonly outboundRateLimitTable: dynamodb.Table;

  constructor(scope: Construct, id: string, props: RateLimitingNestedStackProps) {
    super(scope, id, props);

    const {
      alertAction,
      dynamoConstructName,
      dynamoRateLimitPartitionKey,
      dynamoReplicationRegions,
      dynamoReplicationTimeout,
      dynamoPointInTimeRecovery,
      consumedWriteCapacityUnitsAlertThreshold,
      consumedWriteCapacityUnitsAlertPeriod,
      consumedReadCapacityUnitsAlertThreshold,
      consumedReadCapacityUnitsAlertPeriod,
    } = getSettings(props);

    this.rateLimitTable = this.setupRateLimitTable({
      dynamoConstructName,
      dynamoRateLimitPartitionKey,
      dynamoReplicationRegions,
      dynamoReplicationTimeout,
      dynamoPointInTimeRecovery,
      alertAction,
      consumedWriteCapacityUnitsAlertThreshold,
      consumedWriteCapacityUnitsAlertPeriod,
      consumedReadCapacityUnitsAlertThreshold,
      consumedReadCapacityUnitsAlertPeriod,
    });

    this.outboundRateLimitTable = this.setupOutboundRateLimitTable({
      dynamoConstructName: "OutboundRateLimit",
      dynamoOutboundKeyPartitionKey: "outboundKey",
      dynamoReplicationRegions,
      dynamoReplicationTimeout,
      dynamoPointInTimeRecovery,
      alertAction,
      consumedWriteCapacityUnitsAlertThreshold,
      consumedWriteCapacityUnitsAlertPeriod,
      consumedReadCapacityUnitsAlertThreshold,
      consumedReadCapacityUnitsAlertPeriod,
    });
  }

  private setupRateLimitTable(ownProps: {
    dynamoConstructName: string;
    dynamoRateLimitPartitionKey: string;
    dynamoReplicationRegions: string[];
    dynamoReplicationTimeout: Duration;
    dynamoPointInTimeRecovery: boolean;
    alertAction?: SnsAction;
    consumedWriteCapacityUnitsAlertThreshold: number;
    consumedWriteCapacityUnitsAlertPeriod: number;
    consumedReadCapacityUnitsAlertThreshold: number;
    consumedReadCapacityUnitsAlertPeriod: number;
  }): dynamodb.Table {
    const {
      dynamoConstructName,
      dynamoRateLimitPartitionKey,
      dynamoReplicationRegions,
      dynamoReplicationTimeout,
      dynamoPointInTimeRecovery,
      alertAction,
      consumedWriteCapacityUnitsAlertThreshold,
      consumedWriteCapacityUnitsAlertPeriod,
      consumedReadCapacityUnitsAlertThreshold,
      consumedReadCapacityUnitsAlertPeriod,
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
    addDynamoPerformanceAlerts({
      scope: this,
      table,
      dynamoConstructName,
      consumedWriteCapacityUnitsAlertThreshold: consumedWriteCapacityUnitsAlertThreshold,
      consumedWriteCapacityUnitsAlertPeriod: consumedWriteCapacityUnitsAlertPeriod,
      consumedReadCapacityUnitsAlertThreshold: consumedReadCapacityUnitsAlertThreshold,
      consumedReadCapacityUnitsAlertPeriod: consumedReadCapacityUnitsAlertPeriod,
      alertAction,
    });
    return table;
  }

  // NOTE: this is to be a shared service, see `packages/core/src/command/hl7-notification/heartbeat-sender.ts`
  private setupOutboundRateLimitTable(ownProps: {
    dynamoConstructName: string;
    dynamoOutboundKeyPartitionKey: string;
    dynamoReplicationRegions: string[];
    dynamoReplicationTimeout: Duration;
    dynamoPointInTimeRecovery: boolean;
    alertAction?: SnsAction;
    consumedWriteCapacityUnitsAlertThreshold: number;
    consumedWriteCapacityUnitsAlertPeriod: number;
    consumedReadCapacityUnitsAlertThreshold: number;
    consumedReadCapacityUnitsAlertPeriod: number;
  }): dynamodb.Table {
    const {
      dynamoConstructName,
      dynamoOutboundKeyPartitionKey,
      dynamoReplicationRegions,
      dynamoReplicationTimeout,
      dynamoPointInTimeRecovery,
      alertAction,
      consumedWriteCapacityUnitsAlertThreshold,
      consumedWriteCapacityUnitsAlertPeriod,
      consumedReadCapacityUnitsAlertThreshold,
      consumedReadCapacityUnitsAlertPeriod,
    } = ownProps;
    const table = new dynamodb.Table(this, dynamoConstructName, {
      partitionKey: {
        name: dynamoOutboundKeyPartitionKey,
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
    addDynamoPerformanceAlerts({
      scope: this,
      table,
      dynamoConstructName,
      consumedWriteCapacityUnitsAlertThreshold: consumedWriteCapacityUnitsAlertThreshold,
      consumedWriteCapacityUnitsAlertPeriod: consumedWriteCapacityUnitsAlertPeriod,
      consumedReadCapacityUnitsAlertThreshold: consumedReadCapacityUnitsAlertThreshold,
      consumedReadCapacityUnitsAlertPeriod: consumedReadCapacityUnitsAlertPeriod,
      alertAction,
    });
    return table;
  }
}
