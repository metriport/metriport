import { makeS3Client as coreMakeS3Client } from "@metriport/core/external/aws/s3";
import dayjs from "dayjs";
import duration from "dayjs/plugin/duration";
import { Config } from "../../shared/config";

dayjs.extend(duration);
const DEFAULT_SIGNED_URL_DURATION = dayjs.duration({ minutes: 3 }).asSeconds();

export function makeS3Client() {
  return coreMakeS3Client(Config.getAWSRegion());
}

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
