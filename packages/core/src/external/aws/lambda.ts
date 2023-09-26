import * as AWS from "aws-sdk";

export function makeLambdaClient(region: string) {
  return new AWS.Lambda({ signatureVersion: "v4", region });
}
