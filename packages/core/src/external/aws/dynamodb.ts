import * as AWS from "aws-sdk";
import { DocumentClient } from "aws-sdk/clients/dynamodb";
import { Config } from "../../util/config";

export type DynamoDbUtilsOptions = {
  table: string;
  partitionKey: string;
  rangeKey?: string;
  client?: DocumentClient | undefined;
  region?: string;
};

type AttributeValuesMapping = { [k: string]: string | number };

export class DynamoDbUtils {
  public readonly _docClient: DocumentClient;
  public readonly _table: string;
  public readonly _partitionKey: string;
  public readonly _rangeKey: string | undefined;

  constructor(opts: DynamoDbUtilsOptions) {
    this._table = opts.table;
    this._partitionKey = opts.partitionKey;
    this._rangeKey = opts.rangeKey;
    const region = Config.isDev()
      ? // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
        { region: "localhost", endpoint: process.env.DYNAMODB_ENDPOINT! }
      : { region: opts.region ?? Config.getAWSRegion() };
    this._docClient =
      opts.client ??
      new AWS.DynamoDB.DocumentClient({
        ...region,
        apiVersion: "2012-08-10",
      });
  }

  /*
   * Update will insert if not exists
   */
  async update({
    partition,
    range,
    expression,
    expressionAttributesValues,
    returnValue = "ALL_NEW",
  }: {
    partition: string;
    range?: string;
    expression: string;
    expressionAttributesValues?: AttributeValuesMapping;
    returnValue?: "ALL_OLD" | "ALL_NEW";
  }): Promise<DocumentClient.UpdateItemOutput> {
    const key = this.createKey(partition, range);
    const params: DocumentClient.UpdateItemInput = {
      TableName: this._table,
      Key: key,
      UpdateExpression: expression,
      ...(expressionAttributesValues && { ExpressionAttributeValues: expressionAttributesValues }),
      ReturnValues: returnValue,
    };
    return await this._docClient.update(params).promise();
  }

  async get({
    partition,
    range,
  }: {
    partition: string;
    range?: string;
  }): Promise<DocumentClient.GetItemOutput> {
    const key = this.createKey(partition, range);
    const params: DocumentClient.GetItemInput = {
      TableName: this._table,
      Key: key,
    };
    return await this._docClient.get(params).promise();
  }

  createKey(partition: string, range: string | undefined) {
    return {
      [this._partitionKey]: partition,
      ...(this._rangeKey && range ? { [this._rangeKey]: range } : undefined),
    };
  }
}
