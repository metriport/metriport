import * as AWS from "aws-sdk";
import dayjs from "dayjs";
import duration from "dayjs/plugin/duration";

dayjs.extend(duration);
const DEFAULT_SIGNED_URL_DURATION = dayjs.duration({ minutes: 3 }).asSeconds();

export function makeS3Client(region: string): AWS.S3 {
  return new AWS.S3({ signatureVersion: "v4", region });
}

export async function getSignedUrl({
  bucketName,
  fileName,
  durationSeconds,
  awsRegion,
}: {
  bucketName: string;
  fileName: string;
  durationSeconds?: number;
  awsRegion: string;
}): Promise<string> {
  return makeS3Client(awsRegion).getSignedUrlPromise("getObject", {
    Bucket: bucketName,
    Key: fileName,
    Expires: durationSeconds ?? DEFAULT_SIGNED_URL_DURATION,
  });
}
