import * as AWS from "aws-sdk";
// import { Config } from "../../shared/config";

export function makeS3Client() {
  return new AWS.S3({
    signatureVersion: "v4",
    region: "us-east-2",
    accessKeyId: "XXXXXXXXXXXXX",
    secretAccessKey: "XXXXXXXXXXXXXXXXXXX",
  });
}
