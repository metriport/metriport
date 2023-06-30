import * as Sentry from "@sentry/serverless";
const { DynamoDB } = require("aws-sdk");

export function getEnv(name) {
  return process.env[name];
}
export function getEnvOrFail(name) {
  const value = getEnv(name);
  if (!value || value.trim().length < 1) throw new Error(`Missing env var ${name}`);
  return value;
}

const envType = getEnvOrFail("ENV_TYPE");
const sentryDsn = getEnv("SENTRY_DSN");

// Keep this as early on the file as possible
Sentry.init({
  dsn: sentryDsn,
  enabled: sentryDsn != null,
  environment: envType,
  // TODO #499 Review this based on the load on our app and Sentry's quotas
  tracesSampleRate: 1.0,
});

function curSecSinceEpoch() {
  const now = new Date();
  const utcMilllisecondsSinceEpoch = now.getTime() + now.getTimezoneOffset() * 60 * 1000;
  return Math.round(utcMilllisecondsSinceEpoch / 1000);
}

// validates the token in the request
export const handler = Sentry.AWSLambda.wrapHandler(async event => {
  // ensure token exists, and isn't expired
  var token = "";

  console.log(event);
  if (event.headers && event.headers["api-token"]) {
    token = event.headers["api-token"];
  }

  if (!token && event.queryStringParameters && event.queryStringParameters.state) {
    // check to see if the token was passed in the OAuth state param
    token = event.queryStringParameters.state;
  }
  var effect = "Deny";
  var context = {};

  // only do the query if there's a token to check
  if (token) {
    try {
      const docClient = new DynamoDB.DocumentClient({
        apiVersion: "2012-08-10",
      });
      const doc = await docClient
        .get({
          TableName: process.env.TOKEN_TABLE_NAME,
          Key: { token: token },
        })
        .promise();
      const curTime = curSecSinceEpoch();
      if (doc.Item && doc.Item.expiryTime > curTime) {
        effect = "Allow";
        context = {
          "api-token": token,
          cxId: doc.Item.cxId,
          userId: doc.Item.userId,
        };
      }
    } catch (error) {
      // Don't we want to throw an error here?
      console.error(error);
    }
  }

  const policyDocument = {
    Version: "2012-10-17",
    Statement: [
      {
        Action: "execute-api:Invoke",
        Effect: effect,
        Resource: event.methodArn,
      },
    ],
  };

  return {
    principalId: "apigateway.amazonaws.com",
    policyDocument,
    context,
  };
});
