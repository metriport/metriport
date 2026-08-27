import { makeS3Client as coreMakeS3Client } from "@metriport/core/external/aws/s3";
import dayjs from "dayjs";
import duration from "dayjs/plugin/duration";
import { Config } from "../../shared/config";

dayjs.extend(duration);

/** @deprecated Use S3Utils from @metriport/core/external/aws/s3 instead */
export function makeS3Client() {
  return coreMakeS3Client(Config.getAWSRegion());
}
