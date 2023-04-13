import * as AWS from "aws-sdk";

/**
 * Creates the token table. Destroys the existing one.
 * It removes the existing table and recreates it.
 *
 * This is disabled by default (see first command/comment).
 */
//eslint-disable-next-line @typescript-eslint/no-unused-vars
const createTokenTable = async (ddb: AWS.DynamoDB): Promise<void> => {
  /*
   * Important: if you change the structure here, or if you want data there to
   * be purged across updates on the code/reload, uncomment out the block below.
   */
  // try {
  //   await ddb.deleteTable({ TableName: docTableNames.token }).promise();
  // } catch (error: any) {
  //   if (error && error.code !== "ResourceNotFoundException") {
  //     throw error;
  //   }
  // }
  // const params: AWS.DynamoDB.CreateTableInput = {
  //   AttributeDefinitions: [
  //     {
  //       AttributeName: "token",
  //       AttributeType: "S",
  //     },
  //     {
  //       AttributeName: "oauthUserAccessToken",
  //       AttributeType: "S",
  //     },
  //   ],
  //   KeySchema: [
  //     {
  //       AttributeName: "token",
  //       KeyType: "HASH",
  //     },
  //   ],
  //   GlobalSecondaryIndexes: [
  //     {
  //       IndexName: "oauthUserAccessToken_idx",
  //       KeySchema: [
  //         {
  //           AttributeName: "oauthUserAccessToken",
  //           KeyType: "HASH",
  //         },
  //       ],
  //       Projection: {
  //         ProjectionType: "ALL",
  //       },
  //       ProvisionedThroughput: {
  //         ReadCapacityUnits: 1,
  //         WriteCapacityUnits: 1,
  //       },
  //     },
  //   ],
  //   ProvisionedThroughput: {
  //     ReadCapacityUnits: 1,
  //     WriteCapacityUnits: 1,
  //   },
  //   TableName: docTableNames.token,
  // };
  // await ddb.createTable(params).promise();
};

export const initDDBDev = async (): Promise<AWS.DynamoDB.DocumentClient> => {
  AWS.config.update({
    region: "us-west-1",
    accessKeyId: "xxxx",
    secretAccessKey: "xxxx",
  });
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
