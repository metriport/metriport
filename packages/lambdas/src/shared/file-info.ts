import { makeS3Client } from "@metriport/core/external/aws/s3";
import { getEnvOrFail } from "./env";

const region = getEnvOrFail("AWS_REGION");
const s3client = makeS3Client(region);

export async function getFileInfoFromS3(
  key: string,
  bucket: string
): Promise<
  | { exists: true; size: number; contentType: string }
  | { exists: false; size?: never; contentType?: never }
> {
  try {
    const head = await s3client
      .headObject({
        Bucket: bucket,
        Key: key,
      })
      .promise();
    return { exists: true, size: head.ContentLength ?? 0, contentType: head.ContentType ?? "" };
  } catch (err) {
    return { exists: false };
  }
}
