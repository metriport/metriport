import { partitionKey, sortKey } from "@metriport/core/command/feature-flags/ffs-on-dynamodb";
import { getEnvVarOrFail, rateLimitPartitionKey } from "@metriport/shared";
import * as AWS from "aws-sdk";
import { allowMapiAccess } from "../command/medical/mapi-access";
import { docTableNames } from "./db";

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
  if (doesTableExist) return;
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
// Creates the rate limit table
async function createRateLimitTable(ddb: AWS.DynamoDB): Promise<void> {
  if (!docTableNames.rateLimit) return;

  const doesTableExist = await tableExists(docTableNames.rateLimit, ddb);
  if (doesTableExist) return;
  const params: AWS.DynamoDB.CreateTableInput = {
    AttributeDefinitions: [
      {
        AttributeName: rateLimitPartitionKey,
        AttributeType: "S",
      },
    ],
    KeySchema: [
      {
        AttributeName: rateLimitPartitionKey,
        KeyType: "HASH",
      },
    ],
    ProvisionedThroughput: {
      ReadCapacityUnits: 1,
      WriteCapacityUnits: 1,
    },
    TableName: docTableNames.rateLimit,
  };
  await ddb.createTable(params).promise();
}

async function createFeatureFlagsTable(ddb: AWS.DynamoDB): Promise<void> {
  const doesTableExist = await tableExists(docTableNames.featureFlags, ddb);
  if (doesTableExist) return;
  const params: AWS.DynamoDB.CreateTableInput = {
    AttributeDefinitions: [
      {
        AttributeName: partitionKey,
        AttributeType: "S",
      },
      {
        AttributeName: sortKey,
        AttributeType: "N",
      },
    ],
    KeySchema: [
      {
        AttributeName: partitionKey,
        KeyType: "HASH",
      },
      {
        AttributeName: sortKey,
        KeyType: "RANGE",
      },
    ],
    ProvisionedThroughput: {
      ReadCapacityUnits: 1,
      WriteCapacityUnits: 1,
    },
    TableName: docTableNames.featureFlags,
  };
  await ddb.createTable(params).promise();
}

/**
 * Creates the outbound rate limit table.
 * The outbound rate limit table is used to track the requests sent to external systems.
 * To avoid hitting the rate limit of the external systems.
 * @param ddb - The DynamoDB client
 */
async function createOutboundRateLimitTable(ddb: AWS.DynamoDB): Promise<void> {
  if (!docTableNames.outboundRateLimit) return;
  const doesTableExist = await tableExists(docTableNames.outboundRateLimit, ddb);
  if (doesTableExist) return;

  const params: AWS.DynamoDB.CreateTableInput = {
    AttributeDefinitions: [
      {
        AttributeName: "outboundKey",
        AttributeType: "S",
      },
    ],
    KeySchema: [
      {
        AttributeName: "outboundKey",
        KeyType: "HASH",
      },
    ],
    ProvisionedThroughput: {
      ReadCapacityUnits: 1,
      WriteCapacityUnits: 1,
    },
    TableName: docTableNames.outboundRateLimit,
  };
  await ddb.createTable(params).promise();
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
  await createRateLimitTable(ddb);
  await createFeatureFlagsTable(ddb);
  await createOutboundRateLimitTable(ddb);
  return doc;
}

export async function initLocalCxAccount(): Promise<void> {
  const id = getEnvVarOrFail("LOCAL_ACCOUNT_CXID");
  await allowMapiAccess(id);
}
