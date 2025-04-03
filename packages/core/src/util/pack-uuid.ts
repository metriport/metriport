/**
 * Encodes a UUID to a shorter format using binary conversion and Base64
 * Simplified version without URL-safe encoding
 */
export function packUuid(uuid: string): string {
  if (!isUuid(uuid)) {
    throw new Error("Invalid UUID");
  }
  const hexString = uuid.replace(/-/g, "");
  return Buffer.from(hexString, "hex").toString("base64");
}

/**
 * Decodes a shortened Base64 UUID back to its original form
 */
export function unpackUuid(shortId: string): string {
  const hexString = Buffer.from(shortId, "base64").toString("hex");

  const result = [
    hexString.substring(0, 8),
    hexString.substring(8, 12),
    hexString.substring(12, 16),
    hexString.substring(16, 20),
    hexString.substring(20, 32),
  ].join("-");

  if (!isUuid(result)) {
    throw new Error("Unpacked string is not a valid UUID");
  }

  return result;
}

/**
 * Validates if a string matches UUID format
 */
function isUuid(str: string): boolean {
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  return uuidRegex.test(str);
}
