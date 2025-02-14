import { z } from "zod";
import { BadRequestError } from "../../error/bad-request";

export const exampleEmail = "test@test.com";
const mailtoPrefix = "mailto:";

export function isEmail(email: string): boolean {
  return email.includes("@");
}

export function isEmailValid(email: string): boolean {
  if (!email) return false;
  if (email.length === 0) return false;
  const safeParseEmail = z.string().email().safeParse(email);
  if (!safeParseEmail.success) return false;
  return true;
}

/**
 * @deprecated Use noramlizeEmailBase instead
 */
export function normalizeEmail(email: string): string {
  const trimmedEmail = email.trim();
  return trimmedEmail.toLowerCase();
}

/**
 * @deprecated Use normalizeEmailNew instead
 */
export function normalizeEmailStrict(email: string): string {
  const normalEmail = normalizeEmail(email);
  if (!isEmailValid(normalEmail)) throw new Error("Invalid email.");
  return normalEmail;
}

/**
 * Returns the base email without the mailto prefix and in lowercase
 */
export function noramlizeEmailBase(email: string): string {
  return removeMailto(email.trim().toLowerCase());
}

function removeMailto(email: string): string {
  if (email.startsWith(mailtoPrefix)) {
    return email.slice(mailtoPrefix.length);
  }
  return email;
}

/**
 * Returns the base email without the mailto prefix and in lowercase
 * If the email is not valid, returns undefined
 */
export function normalizeEmailNewSafe(
  email: string,
  normalizeBase: (email: string) => string = noramlizeEmailBase
): string | undefined {
  const baseEmail = normalizeBase(email);
  if (!isEmailValid(baseEmail)) return undefined;
  return baseEmail;
}

/**
 * Returns the base email without the mailto prefix and in lowercase
 * If the email is not valid, throws an error
 */
export function normalizeEmailNew(email: string): string {
  const emailOrUndefined = normalizeEmailNewSafe(email);
  if (!emailOrUndefined) {
    throw new BadRequestError("Invalid email", undefined, { email });
  }
  return emailOrUndefined;
}
