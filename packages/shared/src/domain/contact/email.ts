import { BadRequestError } from "../../error/bad-request";

export const exampleEmail = "test@test.com";
const mailtoPrefix = "mailto:";

// Enhanced email validation that properly handles RFC 5322 characters
const EMAIL_REGEX =
  /^(?=.{1,254}$)(?=.{1,64}@)[A-Za-z0-9!#$%&'*+/=?^_`{|}~-]+(?:\.[A-Za-z0-9!#$%&'*+/=?^_`{|}~-]+)*@(?:[A-Za-z0-9](?:[A-Za-z0-9-]{0,61}[A-Za-z0-9])?\.)+[A-Za-z]{2,63}$/;

export function isEmail(email: string): boolean {
  return email.includes("@");
}

export function isEmailValid(email: string): boolean {
  if (!email) return false;
  if (email.length === 0) return false;

  // Check for phone number format (+1 prefix)
  if (email.startsWith("+1")) {
    return false;
  }

  // Use our enhanced regex instead of Zod's potentially too-strict validation
  return EMAIL_REGEX.test(email);
}

/**
 * Checks if an email appears to be a phone number (starts with +1)
 */
export function isPhoneNumberFormat(email: string): boolean {
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
    if (isPhoneNumberFormat(email)) {
      throw new Error(
        "Invalid email: appears to be a phone number (starts with +1). Please enter a valid email address."
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
    if (isPhoneNumberFormat(email)) {
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
