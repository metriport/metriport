import { S3Utils } from "@metriport/core/external/aws/s3";
import { getEnvOrFail } from "./env";

const region = getEnvOrFail("AWS_REGION");
const s3client = new S3Utils(region);

/** @deprecated Use { S3Utils } from "@metriport/core/external/aws/s3" */
export async function getFileInfoFromS3(
  key: string,
  bucket: string
): Promise<
  | { exists: true; size: number; contentType: string }
  | { exists: false; size?: never; contentType?: never }
> {
  try {
    const head = await s3client.getFileInfoFromS3(key, bucket);
    return { exists: true, size: head.size ?? 0, contentType: head.contentType ?? "" };
  } catch (err) {
    return { exists: false };
  }
}
