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
 * Removes the first digit (country code) if the number is 11 digits long and starts with a 1.
 * Returns the original number (without non-numeric chars) if:
 * - the number is less than 10 digits long
 * - the number is more than 11 digits long
 * - the number is 11 digits long and does not start with a 1
 * @param telephone the phone number to normalize
 */
export function normalizePhoneNumber(telephone: string): string;
/**
 * Normalize a telephone number to a 10-digit string. Removes all non-numeric characters.
 * Removes the first digit (country code) if the number is 11 digits long and starts with a 1.
 * Returns the original number (without non-numeric chars) if:
 * - the number is less than 10 digits long
 * - the number is more than 11 digits long and autofix is false
 * - the number is 11 digits long, it does not start with a 1  and autofix is false
 * @param telephone the phone number to normalize
 * @param telephone the phone number to be normalized
 * @param autofix whether to remove extra digits or not (default: false)
 */
export function normalizePhoneNumber(telephone: string, autofix: boolean): string;
export function normalizePhoneNumber(telephone: string, autofix = false): string {
  const stripped = stripNonNumericChars(telephone);
  const startsWithUsCode = stripped[0] === "1";
  if (stripped.length === phoneLength + 1) {
    if (startsWithUsCode) return stripped.slice(-phoneLength);
    // TODO should we prefer the left or the right most in this situation?
    if (autofix) return stripped.slice(0, phoneLength);
  }

  if (autofix && stripped.length > phoneLength + 1) {
    const initialPosition = startsWithUsCode ? 1 : 0;
    return stripped.slice(initialPosition, initialPosition + phoneLength);
  }
  // TODO should we return the original value w/ non-digits if we're not able to normalize it?
  return stripped;
}
