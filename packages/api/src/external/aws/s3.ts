import * as AWS from "aws-sdk";
import { Config } from "../../shared/config";

export function makeS3Client() {
  return new AWS.S3({ signatureVersion: "v4", region: Config.getAWSRegion() });
}

const DEFAULT_SIGNED_URL_DURATION_SECONDS = 3 * 60; // 3 minutes

export async function getSignedUrl({
  bucketName,
  fileName,
  durationSeconds,
}: {
  bucketName: string;
  fileName: string;
  durationSeconds?: number;
}): Promise<string> {
  return makeS3Client().getSignedUrl("getObject", {
    Bucket: bucketName,
    Key: fileName,
    Expires: durationSeconds ?? DEFAULT_SIGNED_URL_DURATION_SECONDS,
  });
}
