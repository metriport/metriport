import { z } from "zod";

export function toLowerCase(str: string): string {
  return str.toLowerCase();
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
  return str.trim().replace(/\D/g, "");
}

export function stripPeriods(str: string): string {
  return str.trim().replace(/\./g, "");
}

export function normalizeNonEmptyStringSafe(
  str: string,
  applyCase: (str: string) => string = (str: string) => str
): string | undefined {
  const normalizedString = applyCase(str.trim());
  if (normalizedString === "") return undefined;
  return normalizedString;
}

export function normalizeNonEmptyString(
  str: string,
  applyCase: (str: string) => string = (str: string) => str
): string {
  const normalizedString = normalizeNonEmptyStringSafe(str, applyCase);
  if (!normalizedString) throw new Error("Invalid string");
  return normalizedString;
}

export function createNonEmptryStringSchema(param: string): z.ZodSchema {
  return z
    .string()
    .refine(normalizeNonEmptyStringSafe, { message: `Invalid ${param}` })
    .transform(str => normalizeNonEmptyString(str));
}
