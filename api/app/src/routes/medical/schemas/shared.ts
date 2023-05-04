import dayjs from "dayjs";
import { z, ZodString } from "zod";

export const emptyStringToUndefined = (v: string | undefined | null) =>
  v == null || v.length < 1 ? undefined : v;

export const optionalString = (zodSchema: ZodString) =>
  zodSchema.or(z.string().optional()).transform(emptyStringToUndefined);

export function parseToNumericString(str: string): string {
  return str.trim().replace(/\D/g, "");
}

export const ISO_DATE = "YYYY-MM-DD";
export const defaultString = z.string().trim();
export const defaultOptionalString = optionalString(defaultString).nullable();
export const defaultDateString = defaultString.refine(v => dayjs(v, ISO_DATE, true).isValid(), {
  message: `Date must be a valid ISO 8601 date formatted ${ISO_DATE}. Example: 2023-05-03`,
});
const zipLength = 5;
export const defaultZipString = z.coerce
  .string()
  .transform(zipStr => parseToNumericString(zipStr))
  .refine(zip => zip.length === zipLength, {
    message: `Zip must be a string consisting of ${zipLength} numbers`,
  });
export const defaultNameString = defaultString.transform(name => name.split(/[\s,]+/));
