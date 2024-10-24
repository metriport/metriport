import { z } from "zod";

function trimString(str: string): string {
  return str.trim();
}

export function limitStringLength<T extends string | undefined>(
  value: T,
  max = 255,
  suffix = "..."
): T {
  if (!value) return value;
  return (
    value.length > max && value.length > suffix.length
      ? value.substring(0, max - suffix.length) + suffix
      : value
  ) as T;
}

export function stripNonNumericChars(str: string): string {
  return trimString(str).replace(/\D/g, "");
}

export function normalizeNonEmptyString(str: string): string {
  const normalizedString = normalizeNonEmptyStringSafe(str);
  if (!normalizedString) throw new Error("Invalid string");
  return normalizedString;
}

export function normalizeNonEmptyStringSafe(str: string): string | undefined {
  const normalizedString = trimString(str);
  if (normalizedString === "") return undefined;
  return normalizedString;
}

export const nonEmptyStringSchema = z
  .string()
  .refine(normalizeNonEmptyStringSafe, { message: "Invalid string" })
  .transform(str => normalizeNonEmptyString(str));
