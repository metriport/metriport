import { Duration, RemovalPolicy } from "aws-cdk-lib";
import { SnsAction } from "aws-cdk-lib/aws-cloudwatch-actions";
import * as dynamodb from "aws-cdk-lib/aws-dynamodb";
import { Construct } from "constructs";
import { EnvConfig } from "../../config/env-config";
import { addDynamoPerformanceAlerts } from "./ddb";

export type DynamoDBTableConstructProps = {
  config: EnvConfig;
  alertAction?: SnsAction;
  tableSettings: TableConfig;
};

export type TableConfig = {
  constructName: string;
  tableName: string;
  partitionKey: {
    name: string;
    type: dynamodb.AttributeType;
  };
  billingMode?: dynamodb.BillingMode;
  consumedWriteCapacityUnitsAlertThreshold: number;
  consumedWriteCapacityUnitsAlertPeriod: number;
  consumedReadCapacityUnitsAlertThreshold: number;
  consumedReadCapacityUnitsAlertPeriod: number;
  sortKey?: {
    name: string;
    type: dynamodb.AttributeType;
  };
  replicationRegions?: string[];
  replicationTimeout?: Duration;
  pointInTimeRecovery?: boolean;
  removalPolicy?: RemovalPolicy;
};

export class DynamoDBTableConstruct extends Construct {
  readonly docIdToFilepathMappingTable: dynamodb.Table;

  constructor(scope: Construct, id: string, props: DynamoDBTableConstructProps) {
    super(scope, id);

    this.docIdToFilepathMappingTable = this.createTable(props.tableSettings, props.alertAction);
  }

  private createTable(config: TableConfig, alertAction?: SnsAction): dynamodb.Table {
    const {
      constructName,
      tableName,
      partitionKey,
      sortKey,
      replicationRegions,
      replicationTimeout,
      pointInTimeRecovery,
      billingMode = dynamodb.BillingMode.PAY_PER_REQUEST,
      consumedWriteCapacityUnitsAlertThreshold,
      consumedWriteCapacityUnitsAlertPeriod,
      consumedReadCapacityUnitsAlertThreshold,
      consumedReadCapacityUnitsAlertPeriod,
      removalPolicy = RemovalPolicy.RETAIN,
    } = config;

    const table = new dynamodb.Table(this, constructName, {
      tableName,
      partitionKey,
      sortKey,
      replicationRegions,
      replicationTimeout,
      encryption: dynamodb.TableEncryption.AWS_MANAGED,
      pointInTimeRecovery,
      billingMode,
      removalPolicy,
    });

    addDynamoPerformanceAlerts({
      scope: this,
      table,
      dynamoConstructName: constructName,
      consumedWriteCapacityUnitsAlertThreshold,
      consumedWriteCapacityUnitsAlertPeriod,
      consumedReadCapacityUnitsAlertThreshold,
      consumedReadCapacityUnitsAlertPeriod,
      alertAction,
    });

    return table;
  }
}
