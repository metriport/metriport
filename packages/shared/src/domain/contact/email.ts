import { BadRequestError } from "../../error/bad-request";
import validator from "validator";
export const exampleEmail = "test@test.com";
const mailtoPrefix = "mailto:";

export function isEmail(email: string): boolean {
  return email.includes("@");
}

export function isEmailValid(email: string): boolean {
  if (!email) return false;
  if (email.length === 0) return false;

  // Check for phone number format (+1 prefix)
  if (isEmailAPhoneNumber(email)) {
    return false;
  }

  // Use our enhanced regex instead of Zod's potentially too-strict validation
  return validator.isEmail(email, {
    allow_utf8_local_part: true,
    blacklisted_chars: "",
  });
}

/**
 * Checks if an email appears to be a phone number (starts with +1)
 * This has been decided by the team to be an invalid email, and we should not allow it.
 * This means the +1iamarealuser@example.com is an invalid email to us, even though it is technically a valid email.
 */
export function isEmailAPhoneNumber(email: string): boolean {
  return email.trim().startsWith("+1");
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
  if (!isEmailValid(normalEmail)) {
    if (isEmailAPhoneNumber(email)) {
      throw new BadRequestError(
        "Invalid email: appears to be a phone number (starts with +1). Please enter a valid email address.",
        undefined,
        { email }
      );
    }
    throw new Error("Invalid email.");
  }
  return normalEmail;
}

/**
 * Returns the base email without the `mailto:` prefix and in lowercase
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
    if (isEmailAPhoneNumber(email)) {
      throw new BadRequestError(
        "Invalid email: appears to be a phone number (starts with +1). Please enter a valid email address.",
        undefined,
        { email }
      );
    }
    throw new BadRequestError("Invalid email", undefined, { email });
  }
  return emailOrUndefined;
}
