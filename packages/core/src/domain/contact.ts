export type ContactTypes = "email" | "phone";

export type Contact = Partial<Record<ContactTypes, string | undefined>>;

export function stripNonNumericChars(str: string): string {
  return str.trim().replace(/\D/g, "");
}
