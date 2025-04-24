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
 * Converts to lowercase and removes the `mailto:` prefix from the email.
 * @param email - The email to normalize
 */
export function normalizeEmailWithMailto(email: string): string {
  const trimmedEmail = email.trim().toLowerCase();
  if (trimmedEmail.startsWith(mailtoPrefix)) {
    return trimmedEmail.slice(mailtoPrefix.length);
  }
  return trimmedEmail;
}

/**
 * Normalizes email. Converts to lowercase and removes the `mailto:` prefix.
 * @param email - The email to normalize
 */
export function normalizeEmail(
  email: string,
  normalizeBase: (email: string) => string = normalizeEmailWithMailto
): string {
  const normalized = normalizeBase(email);
  return normalized;
}

/**
 * Returns the base email without the mailto prefix and in lowercase
 * If the email is not valid, returns undefined
 * @param email The email to normalize
 */
export function normalizeEmailSafe(email: string): string | undefined {
  const normalEmail = normalizeEmail(email);
  if (!isEmailValid(normalEmail)) return undefined;
  return normalEmail;
}

/**
 * Returns the base email without the mailto prefix and in lowercase
 * If the email is not valid, throws an error
 * @param email The email to normalize
 */
export function normalizeEmailStrict(email: string): string {
  const emailOrUndefined = normalizeEmailSafe(email);
  if (!emailOrUndefined) {
    throw new BadRequestError("Invalid email", undefined, { email });
  }
  return emailOrUndefined;
}
