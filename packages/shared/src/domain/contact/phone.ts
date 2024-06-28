import { stripNonNumericChars } from "../../common/string";

export const phoneLength = 10;
export const examplePhoneNumber = "1231231234";

export function isPhoneValid(phone: string): boolean {
  if (!phone) return false;
  if (phone.length !== phoneLength) return false;
  if (phone.match(/\D/)) return false;
  return true;
}

/**
 * Normalize a telephone number to a 10-digit string. Removes all non-numeric characters and
 * returns the 10 left-most digits if the number is more than 10 digits long.
 * Removes the first digit (country code) if the number is more than 10 digits long and starts
 * with a 1.
 * @param telephone the phone number to be normalized
 */
export function normalizePhoneNumber(telephone: string): string {
  const stripped = stripNonNumericChars(telephone);
  const startsWithUsCode = stripped[0] === "1";
  if (stripped.length > phoneLength) {
    const initialPosition = startsWithUsCode ? 1 : 0;
    return stripped.slice(initialPosition, initialPosition + phoneLength);
  }
  return stripped;
}
