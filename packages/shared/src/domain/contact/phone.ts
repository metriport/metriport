import { stripNonNumericChars } from "../../common/string";
import { BadRequestError } from "../../error/bad-request";

export const phoneLength = 10;
export const examplePhoneNumber = "1231231234";

export function isPhoneNumber(phone: string): boolean {
  const numericChars = phone.replace(/\D/g, "");
  return !phone.includes("@") && numericChars.length >= 10;
}

export function isPhoneValid(phone: string): boolean {
  if (!phone) return false;
  if (phone.length !== phoneLength) return false;
  if (phone.match(/\D/)) return false;
  return true;
}

/**
 * Removes all non-numeric characters and removes the first digit (country code)
 * if the number is 11 digits long and starts with a 1.
 * @param phone The phone number to normalize
 */
export function normalizeUsPhoneWithPlusOne(telephone: string): string {
  const stripped = stripNonNumericChars(telephone);
  const startsWithUsCode = stripped[0] === "1";
  if (startsWithUsCode && stripped.length === phoneLength + 1) {
    return stripped.slice(1);
  }
  return stripped;
}

/**
 * Normalizes a phone number to a 10-digit or less string. Removes all non-numeric characters and
 * returns the 10 left-most digits if the number is more than 10 digits long.
 * Removes the first digit (country code) if the number is more than 10 digits long and starts with a 1.
 * @param phone The phone number to normalize
 */
export function normalizePhoneNumber(
  phone: string,
  normalizeBase = normalizeUsPhoneWithPlusOne
): string {
  const normalized = normalizeBase(phone);
  if (normalized.length > phoneLength) {
    const startsWithUsCode = normalized[0] === "1";
    const initialPosition = startsWithUsCode ? 1 : 0;
    return normalized.slice(initialPosition, initialPosition + phoneLength);
  }
  return normalized;
}

/**
 * Returns the base phone number as a 10-digit or less string.
 * Removes the first digit (country code) if the number is more than 10 digits long and starts with a 1.
 * If the phone number is not valid, returns undefined.
 * @param phone The phone number to normalize
 */
export function normalizePhoneNumberSafe(phone: string): string | undefined {
  const normalPhone = normalizePhoneNumber(phone);
  if (!isPhoneValid(normalPhone)) return undefined;
  return normalPhone;
}

/**
 * Returns the base phone number as a 10-digit or less string.
 * Removes the first digit (country code) if the number is more than 10 digits long and starts with a 1.
 * If the phone number is not valid, throws an error.
 * @param phone The phone number to normalize
 */
export function normalizePhoneNumberStrict(phone: string): string {
  const phoneOrUndefined = normalizePhoneNumberSafe(phone);
  if (!phoneOrUndefined) {
    throw new BadRequestError("Invalid phone", undefined, { phone });
  }
  return phoneOrUndefined;
}
