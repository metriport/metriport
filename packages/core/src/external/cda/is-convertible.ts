import { S3Utils } from "../aws/s3";

/**
 * Checks whether the CDA document on S3 is convertible.
 *
 * @param bucketName - The name of the S3 bucket
 * @param fileKey - The key of the CDA document on S3
 * @param s3Utils - The S3Utils instance
 *
 * @returns If the CDA is convertible, returns its contents. If not, returns the reason why.
 */
export async function isConvertibleFromS3({
  bucketName,
  fileKey,
  s3Utils,
}: {
  bucketName: string;
  fileKey: string;
  s3Utils: S3Utils;
}): Promise<{ isValid: true; contents: string } | { isValid: false; reason: string }> {
  const [fileInfo, payloadRaw] = await Promise.all([
    s3Utils.getFileInfoFromS3(fileKey, bucketName),
    s3Utils.getFileContentsAsString(bucketName, fileKey),
  ]);

  const { isValid, reason } = isConvertible(payloadRaw);
  if (!isValid) {
    return {
      isValid: false,
      reason: `Non-convertible: ${reason} - Filename: ${fileKey}, Size: ${fileInfo.size} bytes`,
    };
  }

  return { isValid: true, contents: payloadRaw };
}

/**
 * Checks whether the CDA document is convertible.
 *
 * @param payloadRaw - The raw XML content as string
 *
 * @returns If the CDA is convertible, returns its contents. If not, returns the reason why.
 */
export function isConvertible(
  payloadRaw: string
): { isValid: true; reason: undefined } | { isValid: false; reason: string } {
  if (payloadRaw.includes("nonXMLBody")) {
    return { isValid: false, reason: "XML document is unstructured CDA with nonXMLBody" };
  }

  if (!payloadRaw.includes("ClinicalDocument")) {
    return { isValid: false, reason: "XML document is not a clinical document" };
  }

  return { isValid: true, reason: undefined };
}
