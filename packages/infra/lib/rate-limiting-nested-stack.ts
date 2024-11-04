import { Duration, NestedStack, NestedStackProps } from "aws-cdk-lib";
import { SnsAction } from "aws-cdk-lib/aws-cloudwatch-actions";
import * as ec2 from "aws-cdk-lib/aws-ec2";
import * as dynamodb from "aws-cdk-lib/aws-dynamodb";
import * as cloudwatch from "aws-cdk-lib/aws-cloudwatch";
import { Construct } from "constructs";
import { EnvConfig } from "../config/env-config";
import { LambdaLayers } from "./shared/lambda-layers";
import { isProd } from "./shared/util";

interface RateLimitingNestedStackProps extends NestedStackProps {
  config: EnvConfig;
  vpc: ec2.IVpc;
  alarmAction?: SnsAction;
  lambdaLayers: LambdaLayers;
}

export class RateLimitingNestedStack extends NestedStack {
  readonly rateLimitingTrackingTable: dynamodb.Table;
  readonly rateLimitingSettingsTable: dynamodb.Table;

  constructor(scope: Construct, id: string, props: RateLimitingNestedStackProps) {
    super(scope, id, props);

    this.rateLimitingTrackingTable = this.setupRateLimitingTrackingTable({
      isProd: this.isProd(props),
      dynamoConstructName: "APIRateLimitingTracking",
      keyName: "cxId_operation",
      alarmAction: props.alarmAction,
    });

    this.rateLimitingSettingsTable = this.setupRateLimitingSettingsTable({
      isProd: this.isProd(props),
      dynamoConstructName: "APIRateLimitingSettings",
      keyName: "cxId_operation",
      alarmAction: props.alarmAction,
    });
  }

  private setupRateLimitingTrackingTable(ownProps: {
    isProd: boolean;
    dynamoConstructName: string;
    keyName: string;
    alarmAction?: SnsAction;
  }): dynamodb.Table {
    const { isProd, dynamoConstructName, keyName, alarmAction } = ownProps;
    const table = new dynamodb.Table(this, dynamoConstructName, {
      partitionKey: {
        name: keyName,
        type: dynamodb.AttributeType.STRING,
      },
      sortKey: { name: "timestamp", type: dynamodb.AttributeType.STRING },
      replicationRegions: isProd ? ["us-east-1"] : ["ca-central-1"],
      replicationTimeout: Duration.hours(3),
      encryption: dynamodb.TableEncryption.AWS_MANAGED,
      pointInTimeRecovery: true,
      timeToLiveAttribute: "ttl",
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
    this.addDynamoPerformanceAlarms(table, dynamoConstructName, alarmAction);
    return table;
  }

  private setupRateLimitingSettingsTable(ownProps: {
    isProd: boolean;
    dynamoConstructName: string;
    keyName: string;
    alarmAction?: SnsAction;
  }): dynamodb.Table {
    const { isProd, dynamoConstructName, keyName, alarmAction } = ownProps;
    const table = new dynamodb.Table(this, dynamoConstructName, {
      partitionKey: {
        name: keyName,
        type: dynamodb.AttributeType.STRING,
      },
      replicationRegions: isProd ? ["us-east-1"] : ["ca-central-1"],
      replicationTimeout: Duration.hours(3),
      encryption: dynamodb.TableEncryption.AWS_MANAGED,
      pointInTimeRecovery: true,
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
    this.addDynamoPerformanceAlarms(table, dynamoConstructName, alarmAction);
    return table;
  }

  private addDynamoPerformanceAlarms(
    table: dynamodb.Table,
    dynamoConstructName: string,
    alarmAction?: SnsAction
  ) {
    const readUnitsMetric = table.metricConsumedReadCapacityUnits();
    const readAlarm = readUnitsMetric.createAlarm(
      this,
      `${dynamoConstructName}ConsumedReadCapacityUnitsAlarm`,
      {
        threshold: 10000, // units per second
        evaluationPeriods: 1,
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
        threshold: 10000, // units per second
        evaluationPeriods: 1,
        treatMissingData: cloudwatch.TreatMissingData.NOT_BREACHING,
      }
    );
    alarmAction && writeAlarm.addAlarmAction(alarmAction);
    alarmAction && writeAlarm.addOkAction(alarmAction);
  }

  private isProd(props: RateLimitingNestedStackProps): boolean {
    return isProd(props.config);
  }
}
