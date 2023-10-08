import * as AWS from "aws-sdk";
import { Config } from "../../shared/config";

/**
 * @deprecated Use @metriport/core instead
 */
export function makeLambdaClient() {
  return new AWS.Lambda({ signatureVersion: "v4", region: Config.getAWSRegion() });
}
