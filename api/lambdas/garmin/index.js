const { DynamoDB } = require("aws-sdk");
import axios from "axios";

const getEnvOrFail = (name) => {
  const value = process.env[name];
  if (!value || value.trim().length < 1)
    throw new Error(`Missing env var ${name}`);
  return value;
};
const api = axios.create();
const apiServerURL = getEnvOrFail('API_URL');
const tableName = getEnvOrFail("TOKEN_TABLE_NAME");
const attribName = "userAccessToken";

const getUAT = (obj, propName) => {
  if (!obj) return undefined;
  const value = obj[propName];
  if (!value) return undefined;
  if (value.length > 0 && value[0][attribName]) return value[0][attribName];
  if (value[attribName]) return value[attribName];
  return undefined;
};
const getUATAsArray = (obj) => {
  if (!obj) return undefined;
  if (obj.length > 0 && obj[0][attribName]) return obj[0][attribName];
  return undefined;
};

const buildResponse = (status, body) => ({
  statusCode: status,
  body,
});

const unauthorized = () => buildResponse(401);

exports.handler = async (req) => {
  console.log(`Verifying at least one UserAuthToken on body...`);

  if (!req.body) return unauthorized();

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

  return unauthorized();
};

async function forwardCallToServer(req) {
  console.log(`Verified! Calling server...`);

  const resp = await api.post(apiServerURL, req.body, { headers: req.headers });

  console.log(`Server response - status: ${resp.status}`);
  console.log(`Server response - body: ${resp.data}`);
  return buildResponse(resp.status, resp.data)
};