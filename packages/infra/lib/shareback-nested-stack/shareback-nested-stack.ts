import { Duration, NestedStack, NestedStackProps } from "aws-cdk-lib";
import { SnsAction } from "aws-cdk-lib/aws-cloudwatch-actions";
import * as dynamodb from "aws-cdk-lib/aws-dynamodb";
import { Construct } from "constructs";
import { EnvConfig } from "../../config/env-config";
import { DynamoDBTableConstruct, TableConfig } from "../shared/dynamodb-construct";
import { isProd } from "../shared/util";

const DOC_ID_MAPPING_TABLE_NAME_PREFIX = "DocIdToFilepathMapping";

export type SharebackNestedStackProps = NestedStackProps & {
  config: EnvConfig;
  alarmAction?: SnsAction;
};

function getDocIdToFilepathMappingTableSettings({ config }: { config: EnvConfig }): TableConfig {
  return {
    constructName: DOC_ID_MAPPING_TABLE_NAME_PREFIX,
    tableName: getDocIdMappingTableName(config),
    partitionKey: {
      name: "docId",
      type: dynamodb.AttributeType.STRING,
    },
    replicationRegions: isProd(config) ? ["us-east-1"] : ["ca-central-1"],
    replicationTimeout: Duration.hours(3),
    pointInTimeRecovery: true,
    consumedWriteCapacityUnitsAlertThreshold: isProd(config) ? 5_000 : 100,
    consumedWriteCapacityUnitsAlertPeriod: 1,
    consumedReadCapacityUnitsAlertThreshold: isProd(config) ? 5_000 : 100,
    consumedReadCapacityUnitsAlertPeriod: 1,
  };
}

export function getDocIdMappingTableName(config: EnvConfig): string {
  return `${DOC_ID_MAPPING_TABLE_NAME_PREFIX}_${config.environmentType}`;
}

export class SharebackNestedStack extends NestedStack {
  readonly docIdToFilepathMappingTable: dynamodb.Table;

  constructor(scope: Construct, id: string, props: SharebackNestedStackProps) {
    super(scope, id, props);

    const { alarmAction } = props;

    const { docIdToFilepathMappingTable } = new DynamoDBTableConstruct(
      this,
      "DocIdToFilepathMappingDdbTable",
      {
        config: props.config,
        alertAction: alarmAction,
        tableSettings: getDocIdToFilepathMappingTableSettings({ config: props.config }),
      }
    );
    this.docIdToFilepathMappingTable = docIdToFilepathMappingTable;
  }
}
