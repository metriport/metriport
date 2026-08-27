import crypto from "crypto";
import { S3Utils } from "../external/aws/s3";

const _sha256 = crypto.createHash("sha256");

/**
 * Returns the sha256 hash of the given string as hexadecimal.
 */
export function sha256(s: string): string {
  return _sha256.update(s).digest("hex");
}

export async function computeS3ObjectSha1(
  s3Utils: S3Utils,
  bucket: string,
  key: string
): Promise<string> {
  const buffer = await s3Utils.downloadFile({ bucket, key });
  return createDocumentHash(buffer);
}

/**
 * Creates the hash from the buffer of the document
 */
export function createDocumentHash(buffer: Buffer): string {
  return crypto.createHash("sha1").update(buffer).digest("hex");
}
