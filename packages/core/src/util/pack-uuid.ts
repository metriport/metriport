import { isValidBase64 } from "./base64";
import { isValidUuid } from "./uuid-v7";

/**
 * Encodes a UUID to a shorter format using binary conversion and Base64
 * Simplified version without URL-safe encoding
 */
export function packUuid(uuid: string): string {
  if (!isValidUuid(uuid)) {
    throw new Error("Invalid UUID");
  }
  const hexString = uuid.replace(/-/g, "");
  return Buffer.from(hexString, "hex").toString("base64");
}

/**
 * Decodes a shortened Base64 UUID back to its original form
 */
export function unpackUuid(shortId: string): string {
  if (!isValidBase64(shortId)) {
    throw new Error("Input is not a valid base64 string");
  }

  const hexString = Buffer.from(shortId, "base64").toString("hex");

  const result = [
    hexString.substring(0, 8),
    hexString.substring(8, 12),
    hexString.substring(12, 16),
    hexString.substring(16, 20),
    hexString.substring(20, 32),
  ].join("-");

  if (!isValidUuid(result)) {
    throw new Error("Unpacked string is not a valid UUID");
  }

  return result;
}
