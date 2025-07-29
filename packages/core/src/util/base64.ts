/**
 * @deprecated Use `@metriport/shared/util/base64` instead.
 */
export function base64ToBuffer(value: string): Buffer {
  return Buffer.from(value, "base64");
}

/**
 * @deprecated Use `@metriport/shared/util/base64` instead.
 */
export function base64ToString(value: string): string {
  return base64ToBuffer(value).toString();
}

/**
 * @deprecated Use `@metriport/shared/util/base64` instead.
 */
export function stringToBase64(value: string): string {
  return Buffer.from(value).toString("base64");
}

/**
 * @deprecated Use `@metriport/shared/util/base64` instead.
 * Validate that a string contains only base64 characters
 * @param str - The string to validate
 * @returns True if string is valid base64, false otherwise
 */
export function isValidBase64(str: string): boolean {
  const base64Regex = /^[A-Za-z0-9+/]*={0,2}$/;
  return base64Regex.test(str);
}

/**
 * @deprecated Use `@metriport/shared/util/base64` instead.
 */
export const BASE64_CHARS = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
