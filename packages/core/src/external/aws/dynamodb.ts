import * as AWS from "aws-sdk";
import { DocumentClient, Key, ExpressionAttributeValueMap } from "aws-sdk/clients/dynamodb";

export class DynamoDbUtils {
  public readonly _docClient: DocumentClient;
  public readonly _table: string;
  public readonly _key: Key;

  constructor(readonly region: string, readonly table: string, readonly key: Key) {
    this._docClient = new AWS.DynamoDB.DocumentClient({
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
    expression,
    expressionAttributesValues,
    returnValue = "ALL_NEW",
  }: {
    expression: string;
    expressionAttributesValues: ExpressionAttributeValueMap;
    returnValue?: "ALL_OLD" | "ALL_NEW";
  }): Promise<DocumentClient.UpdateItemOutput> {
    const params: DocumentClient.UpdateItemInput = {
      TableName: this._table,
      Key: this._key,
      ExpressionAttributeValues: expressionAttributesValues,
      UpdateExpression: expression,
      ReturnValues: returnValue,
    };
    // update will insert if not exists
    return await this._docClient.update(params).promise();
  }

  async getByKey({ sortKey }: { sortKey?: Key }): Promise<DocumentClient.GetItemOutput> {
    const params: DocumentClient.GetItemInput = {
      TableName: this._table,
      Key: { ...this._key, ...sortKey },
    };
    return await this._docClient.get(params).promise();
  }

  async query({
    keyConditionExpression,
    expressionAttributesValues,
  }: {
    keyConditionExpression: string;
    expressionAttributesValues: ExpressionAttributeValueMap;
  }): Promise<DocumentClient.QueryOutput> {
    const params: DocumentClient.QueryInput = {
      TableName: this._table,
      KeyConditionExpression: keyConditionExpression,
      ExpressionAttributeValues: expressionAttributesValues,
    };
    return await this._docClient.query(params).promise();
  }
}
