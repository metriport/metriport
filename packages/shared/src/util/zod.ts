import dayjs from "dayjs";
import { z, ZodString, ZodType } from "zod";
import {
  isValidISODate,
  validateDateIsAfter1900,
  validateIsPastOrPresentSafe,
  ISO_DATE,
} from "../common/date";

export function zodToLowerCase(v: unknown): unknown {
  return typeof v === "string" ? v.toLowerCase() : v;
}

export function emptyStringToUndefined(v: string | undefined | null): string | undefined {
  return v == null || v.length < 1 ? undefined : v;
}

export function optionalString(zodSchema: ZodString) {
  return zodSchema.or(z.string().optional()).transform(emptyStringToUndefined);
}

export function optionalStringPreprocess<T>(zodSchema: ZodType<T>) {
  return z.preprocess(arg => {
    if (typeof arg === "string" && ["", "undefined", "null"].includes(arg.trim())) return undefined;
    else return arg;
  }, zodSchema);
}

export function transformStringUndefined() {
  return z.literal("undefined").transform(() => undefined);
}

export const defaultString = z.string().trim();
export const defaultOptionalString = optionalString(defaultString);

export const defaultDateString = defaultString.refine(isValidISODate, {
  message: `Date must be a valid ISO 8601 date formatted ${ISO_DATE}. Example: 2023-03-15`,
});
export const pastOrTodayDateString = defaultDateString.refine(validateIsPastOrPresentSafe, {
  message: `Date can't be in the future`,
});
export const validDateOfBirthString = pastOrTodayDateString.refine(validateDateIsAfter1900, {
  message: `Date can't be before 1900`,
});

export const defaultNameString = defaultString.min(1);

export function optionalDateToISOString(
  date: string | Date | undefined | null
): string | undefined {
  const preConversion = date && typeof date !== "string" ? dayjs(date).format(ISO_DATE) : date;
  return preConversion ?? undefined;
}
