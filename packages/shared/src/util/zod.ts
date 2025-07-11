import dayjs from "dayjs";
import { z, ZodString, ZodType } from "zod";
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
  return v == null || v.length < 1 ? undefined : v;
}

/**
 * Prefer to use defaultOptionalStringSchema instead.
 */
export function optionalString(zodSchema: ZodString) {
  return zodSchema.or(z.string().optional()).transform(emptyStringToUndefined);
}

/**
 * Note: this can't be used in PATCH endpoints because it will prevent us from identifying whether
 * the field is to be left untouched (undefined) or to be removed (null).
 */
export function optionalStringPreprocess<T>(zodSchema: ZodType<T>) {
  return z.preprocess(arg => {
    if (typeof arg === "string" && ["", "undefined", "null"].includes(arg.trim())) return undefined;
    else return arg;
  }, zodSchema);
}

export function transformStringUndefined() {
  return z.literal("undefined").transform(() => undefined);
}

export function optionalDateToISOString(
  date: string | Date | undefined | null
): string | undefined {
  const preConversion = date && typeof date !== "string" ? dayjs(date).format(ISO_DATE) : date;
  return preConversion ?? undefined;
}
