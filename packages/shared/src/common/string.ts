import { z } from "zod";

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
  return str.trim().replace(/\D/g, "");
}

export function normalizeNonEmptyString(str: string): string {
  const stringOrUndefined = normalizeNonEmptyStringSafe(str);
  if (!stringOrUndefined) throw new Error("Invalid string");
  return stringOrUndefined;
}

export function normalizeNonEmptyStringSafe(str: string): string | undefined {
  const trimmedString = str.trim();
  if (trimmedString === "") return undefined;
  return trimmedString;
}

export function createNonEmptryStringSchema(param: string): z.ZodSchema {
  return z
    .string()
    .refine(normalizeNonEmptyStringSafe, { message: `Invalid ${param}` })
    .transform(str => normalizeNonEmptyString(str));
}
