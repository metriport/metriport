import * as AWS from "aws-sdk";

export function makeS3Client(region: string) {
  return new AWS.S3({ signatureVersion: "v4", region });
}
