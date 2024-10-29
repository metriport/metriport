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

export function stripPeriods(str: string): string {
  return str.trim().replace(/\./g, "");
}

export function normalizeNonEmptyStringSafe(
  str: string,
  applyCase: ((str: string) => string) | undefined = undefined
): string | undefined {
  const trimmedString = str.trim();
  const casedString = applyCase ? applyCase(trimmedString) : trimmedString;
  if (casedString === "") return undefined;
  return casedString;
}

export function normalizeNonEmptyString(
  str: string,
  applyCase: ((str: string) => string) | undefined = undefined
): string {
  const stringOrUndefined = normalizeNonEmptyStringSafe(str, applyCase);
  if (!stringOrUndefined) throw new Error("Invalid string");
  return stringOrUndefined;
}

export function createNonEmptryStringSchema(
  paramTitle: string,
  applyCase: ((str: string) => string) | undefined = undefined
): z.ZodSchema {
  return z
    .string()
    .refine(str => normalizeNonEmptyStringSafe(str, applyCase), {
      message: `Invalid ${paramTitle}`,
    })
    .transform(str => normalizeNonEmptyString(str, applyCase));
}
