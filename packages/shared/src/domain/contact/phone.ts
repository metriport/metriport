import { z } from "zod";
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
  if (!phoneOrUndefined) throw new Error("Invalid phone.");
  return phoneOrUndefined;
}

export const phoneSchema = z.coerce
  .string()
  .refine(normalizePhoneSafe, { message: "Invalid phone" })
  .transform(phone => normalizePhone(phone));
