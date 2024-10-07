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
  const trimmedEmail = email.trim().toLowerCase();
  if (trimmedEmail.startsWith("mailto:")) {
    return trimmedEmail.slice(7);
  }
  if (!isEmailValid(trimmedEmail)) return undefined;
  return trimmedEmail;
}

export function normalizeEmail(email: string): string {
  const emailOrUndefined = normalizeEmailSafe(email);
  if (!emailOrUndefined) throw new Error("Invalid email.");
  return emailOrUndefined;
}
