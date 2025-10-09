import { createXMLParser } from "@metriport/shared/common/xml-parser";
import { BadRequestError } from "@metriport/shared";
import { S3Utils } from "../aws/s3";

// This is the most straightforward instructions we normally see in CCDAs
const xmlProcessingInstructions = `<?xml version="1.0" encoding="UTF-8"?>`;

/**
 * Checks whether the CDA document on S3 is convertible.
 *
 * @param bucketName - The name of the S3 bucket
 * @param fileKey - The key of the CDA document on S3
 * @param s3Utils - The S3Utils instance
 *
 * @returns If the CDA is convertible, returns its contents. If not, returns the reason why.
 */
export async function getFileContentsFromS3IfConvertible({
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

  return getFileContentsIfConvertible(payloadRaw, fileKey, fileInfo.size);
}

export function getFileContentsIfConvertible(
  payloadRaw: string,
  fileKey: string,
  size: number | undefined
): { isValid: true; contents: string } | { isValid: false; reason: string } {
  const { isValid, reason } = isConvertible(payloadRaw);
  if (!isValid) {
    return {
      isValid: false,
      reason: `Non-convertible: ${reason} - Filename: ${fileKey}, Size: ${size} bytes`,
    };
  }

  return {
    isValid: true,
    contents: payloadRaw,
  };
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

export function getSanitizedContents(payloadRaw: string): string {
  return isSanitizationNeeded(payloadRaw)
    ? sanitizeXmlProcessingInstructions(payloadRaw)
    : payloadRaw;
}

/**
 * If the payloadRaw parses, no sanitization is needed
 */
function isSanitizationNeeded(payloadRaw: string): boolean {
  const parser = createXMLParser({
    ignoreAttributes: false,
    attributeNamePrefix: "_",
    removeNSPrefix: true,
  });

  try {
    parser.parse(payloadRaw);
    return false;
  } catch (error) {
    console.log("Sanitization needed");
    return true;
  }
}

/**
 * Sometimes, the XML processing instructions are faulty, resulting in a parse error.
 * For example, sometimes they indicate it as being a text file, rather than XML,
 * which is why we need to sanitize the XML processing instructions.
 */
export function sanitizeXmlProcessingInstructions(xml: string): string {
  const indexOfDocumentStart = xml.indexOf("<Clinical");
  if (indexOfDocumentStart === -1) {
    throw new BadRequestError("No ClinicalDocument found in XML");
  }

  return xmlProcessingInstructions.concat(xml.substring(indexOfDocumentStart));
}
