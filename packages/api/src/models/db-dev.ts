import * as AWS from "aws-sdk";
import { docTableNames } from "./db";
import { getEnvVarOrFail } from "../shared/config";
import { allowMapiAccess } from "../command/medical/mapi-access";

//Checks if the table exists in the db
async function tableExists(tableName: string, ddb: AWS.DynamoDB) {
  try {
    await ddb.describeTable({ TableName: tableName }).promise();
    return true;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } catch (error: any) {
    if (error.code === "ResourceNotFoundException") {
      return false;
    }
  }
}
// Creates the token table
async function createTokenTable(ddb: AWS.DynamoDB): Promise<void> {
  const doesTableExist = await tableExists(docTableNames.token, ddb);
  if (!doesTableExist) {
    const params: AWS.DynamoDB.CreateTableInput = {
      AttributeDefinitions: [
        {
          AttributeName: "token",
          AttributeType: "S",
        },
        {
          AttributeName: "oauthUserAccessToken",
          AttributeType: "S",
        },
      ],
      KeySchema: [
        {
          AttributeName: "token",
          KeyType: "HASH",
        },
      ],
      GlobalSecondaryIndexes: [
        {
          IndexName: "oauthUserAccessToken_idx",
          KeySchema: [
            {
              AttributeName: "oauthUserAccessToken",
              KeyType: "HASH",
            },
          ],
          Projection: {
            ProjectionType: "ALL",
          },
          ProvisionedThroughput: {
            ReadCapacityUnits: 1,
            WriteCapacityUnits: 1,
          },
        },
      ],
      ProvisionedThroughput: {
        ReadCapacityUnits: 1,
        WriteCapacityUnits: 1,
      },
      TableName: docTableNames.token,
    };
    await ddb.createTable(params).promise();
  }
}
// Creates the rate limting tracaking table
async function createRateLimitTrackingTable(ddb: AWS.DynamoDB): Promise<void> {
  if (!docTableNames.rateLimitingTracking) return;
  const doesTableExist = await tableExists(docTableNames.rateLimitingTracking, ddb);
  if (!doesTableExist) {
    const params: AWS.DynamoDB.CreateTableInput = {
      AttributeDefinitions: [
        {
          AttributeName: "cxIdAndOperation",
          AttributeType: "S",
        },
        {
          AttributeName: "windowTimestamp",
          AttributeType: "S",
        },
      ],
      KeySchema: [
        {
          AttributeName: "cxIdAndOperation",
          KeyType: "HASH",
        },
        {
          AttributeName: "windowTimestamp",
          KeyType: "RANGE",
        },
      ],
      ProvisionedThroughput: {
        ReadCapacityUnits: 1,
        WriteCapacityUnits: 1,
      },
      TableName: docTableNames.rateLimitingTracking,
    };
    await ddb.createTable(params).promise();
  }
}
// Creates the rate limiting settings table
async function creatSettingsTable(ddb: AWS.DynamoDB): Promise<void> {
  if (!docTableNames.rateLimitingSettings) return;
  const doesTableExist = await tableExists(docTableNames.rateLimitingSettings, ddb);
  if (!doesTableExist) {
    const params: AWS.DynamoDB.CreateTableInput = {
      AttributeDefinitions: [
        {
          AttributeName: "cxIdAndOperation",
          AttributeType: "S",
        },
      ],
      KeySchema: [
        {
          AttributeName: "cxIdAndOperation",
          KeyType: "HASH",
        },
      ],
      ProvisionedThroughput: {
        ReadCapacityUnits: 1,
        WriteCapacityUnits: 1,
      },
      TableName: docTableNames.rateLimitingSettings,
    };
    await ddb.createTable(params).promise();
  }
}
export async function initDDBDev(): Promise<AWS.DynamoDB.DocumentClient> {
  const doc = new AWS.DynamoDB.DocumentClient({
    apiVersion: "2012-08-10",
    endpoint: process.env.DYNAMODB_ENDPOINT,
  });
  const ddb = new AWS.DynamoDB({
    apiVersion: "2012-08-10",
    endpoint: process.env.DYNAMODB_ENDPOINT,
  });
  await createTokenTable(ddb);
  await createRateLimitTrackingTable(ddb);
  await creatSettingsTable(ddb);
  return doc;
}

export async function initLocalCxAccount(): Promise<void> {
  const id = getEnvVarOrFail("LOCAL_ACCOUNT_CXID");
  await allowMapiAccess(id);
}
