import * as AWS from "aws-sdk";
import { docTableNames } from "./db";
import { getEnvVarOrFail } from "../shared/config";
import { allowMapiAccess } from "../command/medical/mapi-access";

//Checks if the table exists in the db
const tableExists = async (tableName: string, ddb: AWS.DynamoDB) => {
  try {
    await ddb.describeTable({ TableName: tableName }).promise();
    return true;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } catch (error: any) {
    if (error.code === "ResourceNotFoundException") {
      return false;
    }
  }
};

//Creates the token table
const createTokenTable = async (ddb: AWS.DynamoDB): Promise<void> => {
  //Create a new table if it doesn't already exist
  if (!(await tableExists(docTableNames.token, ddb))) {
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
};
export const initDDBDev = async (): Promise<AWS.DynamoDB.DocumentClient> => {
  const doc = new AWS.DynamoDB.DocumentClient({
    apiVersion: "2012-08-10",
    endpoint: process.env.DYNAMODB_ENDPOINT,
  });
  const ddb = new AWS.DynamoDB({
    apiVersion: "2012-08-10",
    endpoint: process.env.DYNAMODB_ENDPOINT,
  });
  await createTokenTable(ddb);
  return doc;
};

export async function initLocalCxAccount(): Promise<void> {
  const id = getEnvVarOrFail("LOCAL_ACCOUNT_CXID");
  await allowMapiAccess(id);
}
