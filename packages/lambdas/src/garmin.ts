import { DynamoDB } from "aws-sdk";
import axios from "axios";
import { getEnvOrFail } from "./shared/env";

const apiServerURL = getEnvOrFail("API_URL");
const tableName = getEnvOrFail("TOKEN_TABLE_NAME");

const attribName = "userAccessToken";
const api = axios.create();

//eslint-disable-next-line @typescript-eslint/no-explicit-any
const getUAT = (obj: any, propName: string) => {
  if (!obj) return undefined;
  const value = obj[propName];
  if (!value) return undefined;
  if (value.length > 0 && value[0][attribName]) return value[0][attribName];
  if (value[attribName]) return value[attribName];
  return undefined;
};
//eslint-disable-next-line @typescript-eslint/no-explicit-any
const getUATAsArray = (obj: any) => {
  if (!obj) return undefined;
  if (obj.length > 0 && obj[0][attribName]) return obj[0][attribName];
  return undefined;
};

const buildResponse = (status: number, body?: unknown) => ({
  statusCode: status,
  body,
});

const defaultResponse = () => buildResponse(200);

//eslint-disable-next-line @typescript-eslint/no-explicit-any
type Request = { body?: any; headers: Record<string, string> };

export const handler = async (req: Request) => {
  console.log(`Verifying at least one UserAuthToken on body...`);

  if (!req.body) {
    console.log("Request has no body - will not be forwarded to the API");
    return defaultResponse();
  }

  const body = JSON.parse(req.body);

  const oauthUserAccessToken =
    // AUTH
    getUAT(body, "deregistrations") ||
    getUAT(body, "userPermissionsChange") ||
    // HEALTH
    getUAT(body, "dailies") ||
    getUAT(body, "thirdPartyDailies") ||
    getUAT(body, "epochs") ||
    getUAT(body, "sleeps") ||
    getUAT(body, "bodyComps") ||
    getUAT(body, "stress") ||
    getUAT(body, "userMetrics") ||
    getUAT(body, "pulseOx") ||
    getUAT(body, "respiration") ||
    getUAT(body, "healthSnapshot") ||
    getUAT(body, "hrv") ||
    // ACTIVITIES
    getUAT(body, "activities") ||
    getUATAsArray(body);

  console.log(`Token: ${oauthUserAccessToken}`);

  // only do the query if there's a token to check
  if (oauthUserAccessToken) {
    try {
      const docClient = new DynamoDB.DocumentClient({
        apiVersion: "2012-08-10",
      });
      const items = await docClient
        .query({
          TableName: tableName,
          IndexName: "oauthUserAccessToken_idx",
          KeyConditionExpression: "oauthUserAccessToken = :uat",
          ExpressionAttributeValues: {
            ":uat": oauthUserAccessToken,
          },
        })
        .promise();
      if (items && items.Items) {
        // Access OK
        return forwardCallToServer(req);
      }
    } catch (error) {
      console.error(error);
    }
  }

  console.log("Request has no UAT - will not be forwarded to the API");
  return defaultResponse();
};

async function forwardCallToServer(req: Request) {
  console.log(`Verified! Calling server...`);

  const resp = await api.post(apiServerURL, req.body, { headers: req.headers });

  console.log(`Server response - status: ${resp.status}`);
  console.log(`Server response - body: ${resp.data}`);
  return buildResponse(resp.status, resp.data);
}
