import { z } from "zod";

export const exampleEmail = "test@test.com";

export function isEmailValid(email: string): boolean {
  if (!email) return false;
  if (email.length === 0) return false;
  const safeParseEmail = z.string().email().safeParse(email);
  if (!safeParseEmail.success) return false;
  return true;
}

/**
 * Normalize an email.
 * @param email the email to be normalized
 */
export function normalizeEmail(email: string): string {
  const trimmedEmail = email.trim();
  return trimmedEmail.toLowerCase();
}
