import * as AWS from "aws-sdk";
import dayjs from "dayjs";
import duration from "dayjs/plugin/duration";
import { Config } from "../../shared/config";

dayjs.extend(duration);
const DEFAULT_SIGNED_URL_DURATION = dayjs.duration({ minutes: 3 }).asSeconds();

/**
 * @deprecated Use @metriport/core instead
 */
export function makeS3Client() {
  return new AWS.S3({ signatureVersion: "v4", region: Config.getAWSRegion() });
}

/**
 * @deprecated Use @metriport/core instead
 */
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
    Expires: durationSeconds ?? DEFAULT_SIGNED_URL_DURATION,
  });
}
