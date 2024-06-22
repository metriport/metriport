import { stripNonNumericChars } from "../../common/string";

export const phoneLength = 10;
export const examplePhoneNumber = "1231231234";

export function isPhoneValid(phone: string): boolean {
  if (!phone) return false;
  if (phone.length !== phoneLength) return false;
  if (phone.match(/\D/)) return false; // needed as parseInt ignores non-numeric suffix
  const phoneNumber = parseInt(phone, 10);
  return !isNaN(phoneNumber);
}

/**
 * Normalize a telephone number to a 10-digit string. Removes all non-numeric characters.
 * This should not be used in code that parses phone numbers from user input, as it will
 * remove the leftmost digits if the phone number is longer than 10 digits, which can lead to
 * phone numbers with extensions having the extensions and missing important parts of the actual
 * phone number.
 * @param telephone
 */
export function normalizePhoneNumber(telephone: string): string;
/**
 * Normalize a telephone number to a 10-digit string. Removes all non-numeric characters.
 * If in strict mode, only normalizes 10 to 11 digits strings (don't transform incorrect values
 * with extensions and etc.).
 * This should not be used with strict=false in code that parses phone numbers from user input, as
 * it will remove the leftmost digits if the phone number is longer than 10 digits, which can lead
 * to phone numbers with extensions having the extensions and missing important parts of the actual
 * phone number.
 * @param telephone the phone number to be normalized
 * @param strict whether to normalize only 10 to 11 digits strings (default: false)
 */
export function normalizePhoneNumber(telephone: string, strict: boolean): string;
export function normalizePhoneNumber(telephone: string, strict = false): string {
  const stripped = stripNonNumericChars(telephone);
  if (!strict) {
    return stripped.slice(-1 * phoneLength);
  }
  if (stripped.length === phoneLength + 1) {
    return stripped.slice(1);
  }
  return stripped;
}
