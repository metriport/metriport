import * as AWS from "aws-sdk";
import { Config } from "../../shared/config";

/**
 * @deprecated Use @metriport/core/aws instead
 */
export function makeS3Client() {
  return new AWS.S3({ signatureVersion: "v4", region: Config.getAWSRegion() });
}
