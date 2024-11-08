import * as AWS from "aws-sdk";
import { DocumentClient } from "aws-sdk/clients/dynamodb";
import { errorToString } from "@metriport/shared";
import { capture, out } from "../../util";

export type DdbMapping = Record<string, string | number>;

export class DynamoDbUtils {
  public readonly _docClient: DocumentClient;
  public readonly _table: string;
  public readonly _key: DdbMapping;

  constructor(
    readonly region: string,
    readonly table: string,
    readonly key: DdbMapping,
    readonly client?: DocumentClient | undefined
  ) {
    this._docClient =
      client ??
      new AWS.DynamoDB.DocumentClient({
        region,
        apiVersion: "2012-08-10",
      });
    this._table = table;
    this._key = key;
  }

  get docClient(): DocumentClient {
    return this._docClient;
  }

  async update({
    sortKey,
    expression,
    expressionAttributesValues,
    returnValue = "ALL_NEW",
  }: {
    sortKey?: DdbMapping;
    expression: string;
    expressionAttributesValues: DdbMapping;
    returnValue?: "ALL_OLD" | "ALL_NEW";
  }): Promise<DocumentClient.UpdateItemOutput> {
    const { log } = out(`update DDB - table ${this._table} key ${this._key}`);
    const key = { ...this._key, ...sortKey };
    const params: DocumentClient.UpdateItemInput = {
      TableName: this._table,
      Key: key,
      UpdateExpression: expression,
      ExpressionAttributeValues: expressionAttributesValues,
      ReturnValues: returnValue,
    };
    // update will insert if not exists
    try {
      return await this._docClient.update(params).promise();
    } catch (error) {
      const msg = `Error updating ${this._table} @ DDB`;
      log(`${msg} - error: ${errorToString(error)}`);
      capture.error(msg, {
        extra: {
          table: this._table,
          key,
          expression,
          expressionAttributesValues,
          returnValue,
          context: "ddb.update",
          error,
        },
      });
      throw error;
    }
  }

  async getByKey(
    sortKey: DdbMapping | undefined = undefined
  ): Promise<DocumentClient.GetItemOutput> {
    const { log } = out(`getByKey DDB - table ${this._table} key ${this._key}`);
    const key = { ...this._key, ...sortKey };
    const params: DocumentClient.GetItemInput = {
      TableName: this._table,
      Key: key,
    };
    try {
      return await this._docClient.get(params).promise();
    } catch (error) {
      const msg = `Error getting by key ${this._table} @ DDB`;
      log(`${msg} - error: ${errorToString(error)}`);
      capture.error(msg, {
        extra: {
          table: this._table,
          key,
          context: "ddb.getByKey",
          error,
        },
      });
      throw error;
    }
  }

  async query({
    keyConditionExpression,
    expressionAttributesValues,
  }: {
    keyConditionExpression: string;
    expressionAttributesValues: DdbMapping;
  }): Promise<DocumentClient.QueryOutput> {
    const { log } = out(`query DDB - table ${this._table} key ${this._key}`);
    const params: DocumentClient.QueryInput = {
      TableName: this._table,
      KeyConditionExpression: keyConditionExpression,
      ExpressionAttributeValues: expressionAttributesValues,
    };
    try {
      return await this._docClient.query(params).promise();
    } catch (error) {
      const msg = `Error querying ${this._table} @ DDB`;
      log(`${msg} - error: ${errorToString(error)}`);
      capture.error(msg, {
        extra: {
          table: this._table,
          keyConditionExpression,
          expressionAttributesValues,
          context: "ddb.query",
          error,
        },
      });
      throw error;
    }
  }
}
