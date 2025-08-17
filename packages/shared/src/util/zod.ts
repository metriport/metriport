import { z, ZodString } from "zod";
import {
  ISO_DATE,
  isValidISODate,
  validateDateIsAfter1900,
  validateIsPastOrPresentSafe,
} from "../common/date";
import { stripNonNumericChars } from "../common/string";

export const defaultStringSchema = z.string().trim();
export const defaultOptionalStringSchema = optionalString(defaultStringSchema);

export const defaultDateStringSchema = defaultStringSchema.refine(isValidISODate, {
  message: `Date must be a valid ISO 8601 date formatted ${ISO_DATE}. Example: 2023-03-15`,
});

export const pastOrTodayDateStringSchema = defaultDateStringSchema.refine(
  validateIsPastOrPresentSafe,
  {
    message: `Date can't be in the future`,
  }
);

export const validDateOfBirthStringSchema = pastOrTodayDateStringSchema.refine(
  validateDateIsAfter1900,
  {
    message: `Date can't be before 1900`,
  }
);

export const defaultNameStringSchema = defaultStringSchema.min(1);

const zipLength = 5;
export const defaultZipStringSchema = z.coerce
  .string()
  .transform(zipStr => stripNonNumericChars(zipStr))
  .refine(zip => zip.length === zipLength, {
    message: `Zip must be a string consisting of ${zipLength} numbers`,
  });

export function zodToLowerCase(v: unknown): unknown {
  return typeof v === "string" ? v.toLowerCase() : v;
}

export function emptyStringToUndefined(v: string | undefined | null): string | undefined {
  if (v == null) return undefined;
  if (typeof v === "string" && v.trim().length < 1) return undefined;
  return v;
}

/**
 * Prefer to use defaultOptionalStringSchema instead.
 */
export function optionalString(zodSchema: ZodString) {
  return zodSchema.or(z.string().optional()).transform(emptyStringToUndefined);
}
