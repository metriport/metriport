import { z } from "zod";
import { BadRequestError } from "../../error/bad-request";

export const exampleEmail = "test@test.com";

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

export function normalizeEmail(email: string): string {
  const trimmedEmail = email.trim();
  return trimmedEmail.toLowerCase();
}

function noramlizeEmailBase(email: string): string {
  return removeMailto(email.trim().toLowerCase());
}

function removeMailto(email: string): string {
  if (email.startsWith("mailto:")) {
    return email.slice(7);
  }
  return email;
}

export function normalizeEmailSafe(
  email: string,
  normalizeBase: (email: string) => string = noramlizeEmailBase
): string | undefined {
  const baseEmail = normalizeBase(email);
  if (!isEmailValid(baseEmail)) return undefined;
  return baseEmail;
}

export function normalizeEmailStrict(email: string): string {
  const emailOrUndefined = normalizeEmailSafe(email);
  if (!emailOrUndefined) {
    throw new BadRequestError("Invalid email", undefined, { email });
  }
  return emailOrUndefined;
}
