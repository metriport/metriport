import { z } from "zod";
import { BadRequestError } from "../../error/bad-request";
import { stripNonNumericChars } from "../../common/string";

export const phoneLength = 10;
export const examplePhoneNumber = "1231231234";

export function isPhoneNumber(phone: string): boolean {
  const numericChars = phone.replace(/\D/g, "");
  return !phone.includes("@") && numericChars.length >= 10;
}

export function isPhoneValid(phone: string): boolean {
  if (!phone) return false;
  if (phone.length < 8) return false;
  if (phone.match(/\D/)) return false;
  return true;
}

function noramlizePhoneBase(phone: string): string {
  return stripNonNumericChars(phone.trim());
}

export function normalizePhoneSafe(
  phone: string,
  normalizeBase: (phone: string) => string = noramlizePhoneBase
): string | undefined {
  const basePhone = normalizeBase(phone);
  if (!isPhoneValid(basePhone)) return undefined;
  if (basePhone.length === phoneLength) return basePhone;
  if (basePhone.length < phoneLength) return basePhone.padStart(phoneLength, "0");
  const startsWithUsCode = basePhone[0] === "1";
  const initialPosition = startsWithUsCode ? 1 : 0;
  return basePhone.slice(initialPosition, initialPosition + phoneLength);
}

export function normalizePhone(phone: string): string {
  const phoneOrUndefined = normalizePhoneSafe(phone);
  if (!phoneOrUndefined) {
    throw new BadRequestError("Invalid phone", undefined, { phone });
  }
  return phoneOrUndefined;
}

export const phoneSchema = z.coerce
  .string()
  .refine(normalizePhoneSafe, { message: "Invalid phone" })
  .transform(phone => normalizePhone(phone));

/**	function noramlizePhoneBase(phone: string): string {
 * Normalize a telephone number to a 10-digit string. Removes all non-numeric characters.	  return stripNonNumericChars(phone.trim());
 * Removes the first digit (country code) if the number is more than 10 digits long and starts
 * with a 1.
 * @param telephone the phone number to be normalized
 */
export function normalizeUsPhoneWithPlusOne(telephone: string): string {
  const stripped = stripNonNumericChars(telephone);
  const startsWithUsCode = stripped[0] === "1";
  if (startsWithUsCode && stripped.length === phoneLength + 1) {
    return stripped.slice(1);
  }
  return stripped;
}
