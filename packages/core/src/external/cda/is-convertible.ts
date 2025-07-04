/**
 * Checks if the XML payload is a convertible CDA document.
 *
 * @param payloadRaw - The raw XML content as string
 * @param s3FileName - The filename for logging purposes
 *
 * @returns Object with validation result and reason if invalid
 */
export function isConvertible(
  payloadRaw: string,
  s3FileName: string
): {
  isValid: boolean;
  reason?: string;
} {
  if (payloadRaw.includes("nonXMLBody")) {
    return {
      isValid: false,
      reason: `XML document is unstructured CDA with nonXMLBody - Filename: ${s3FileName}`,
    };
  }

  if (!payloadRaw.includes("ClinicalDocument")) {
    return {
      isValid: false,
      reason: `XML document is not a clinical document - Filename: ${s3FileName}`,
    };
  }

  return { isValid: true };
}
