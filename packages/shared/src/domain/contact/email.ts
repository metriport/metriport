import { z } from "zod";

export const exampleEmail = "test@test.com";

export function isEmailValid(email: string): boolean {
  if (!email) return false;
  if (email.length === 0) return false;
  const safeParseEmail = z.string().email().safeParse(email);
  if (!safeParseEmail.success) return false;
  return true;
}

export function normalizeEmailSafe(email: string): string | undefined {
  const strippedEmail = removeMailto(email.trim().toLowerCase());
  if (!isEmailValid(strippedEmail)) return undefined;
  return strippedEmail;
}

export function normalizeEmail(email: string): string {
  const emailOrUndefined = normalizeEmailSafe(email);
  if (!emailOrUndefined) throw new Error("Invalid email.");
  return emailOrUndefined;
}

function removeMailto(email: string): string {
  if (email.startsWith("mailto:")) {
    return email.slice(7);
  }
  return email;
}
