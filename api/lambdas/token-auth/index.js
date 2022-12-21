const { DynamoDB } = require("aws-sdk");

function curSecSinceEpoch() {
  const now = new Date();
  const utcMilllisecondsSinceEpoch =
    now.getTime() + now.getTimezoneOffset() * 60 * 1000;
  return Math.round(utcMilllisecondsSinceEpoch / 1000);
}

// validates the token in the request
exports.handler = async (event) => {
  // ensure token exists, and isn't expired
  var token = "";
  
  console.log(event);
  if (event.headers && event.headers['api-token']) {
    token = event.headers['api-token'];
  }
  
  if (
    !token &&
    event.queryStringParameters &&
    event.queryStringParameters.state
  ) {
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
};
