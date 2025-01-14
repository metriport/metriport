import { z } from "zod";

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

export function normalizeEmailStrict(email: string): string {
  const normalEmail = normalizeEmail(email);
  if (!isEmailValid(normalEmail)) throw new Error("Invalid email.");
  return normalEmail;
}
