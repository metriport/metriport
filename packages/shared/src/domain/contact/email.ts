export const exampleEmail = "test@test.com";

export function isEmailValid(email: string): boolean {
  if (!email) return false;
  if (email.length === 0) return false;
  if (email.match(/(^[a-zA-Z0-9_.+-]+@[a-zA-Z0-9-]+\.[a-zA-Z0-9-.]+$)/)) return false;
  return true;
}

/**
 * Normalize an email.
 * @param email the phone number to be normalized
 */
export function normalizeEmail(email: string): string {
  const trimmedEmail = email.trim();
  return trimmedEmail.toLowerCase();
}
