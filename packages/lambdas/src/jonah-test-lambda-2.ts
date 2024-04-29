import * as AWS from "aws-sdk";
import axios from "axios";
import { v4 as uuidv4 } from "uuid";

const dynamoDb = new AWS.DynamoDB.DocumentClient();
const tableName = process.env.REQUEST_TABLE_NAME || "default-table-name";

//eslint-disable-next-line
export const handler = async (event: any) => {
  console.log("Received event:", JSON.stringify(event), tableName);

  for (const record of event.Records) {
    const { url, index } = JSON.parse(record.body);
    const requestId = uuidv4(); // Generate a unique requestId

    try {
      const response = await axios.get(url);
      await logResultToDynamoDB(requestId, index, "SUCCESS", response.data);
      //eslint-disable-next-line
    } catch (error: any) {
      await logResultToDynamoDB(requestId, index, "FAILED", error.message);
    }
  }
};

//eslint-disable-next-line
async function logResultToDynamoDB(requestId: string, index: number, status: string, result: any) {
  const params = {
    TableName: tableName,
    Item: {
      requestId,
      index,
      status,
      result: JSON.stringify(result),
      timestamp: new Date().toISOString(),
    },
  };

  await dynamoDb.put(params).promise();
}
