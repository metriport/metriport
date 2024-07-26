import { APIGatewayProxyEventV2 } from "aws-lambda";

export async function handler(event: APIGatewayProxyEventV2) {
  console.log("Received event:", JSON.stringify(event, null, 2));

  return {
    statusCode: 200,
    body: JSON.stringify({ message: "Event logged successfully" }),
  };
}
