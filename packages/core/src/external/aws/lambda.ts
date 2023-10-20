import * as AWS from "aws-sdk";
import { base64ToString } from "../../util/base64";

export function makeLambdaClient(region: string) {
  return new AWS.Lambda({ signatureVersion: "v4", region });
}

export function logResultToString(logResult: string | undefined): string | undefined {
  if (!logResult) return logResult;
  return base64ToString(logResult);
}
