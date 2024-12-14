import { z, ZodString } from "zod";

export const optionalString = (zodSchema: ZodString) =>
  zodSchema.or(z.string().optional()).transform(emptyStringToUndefined);

export const emptyStringToUndefined = (v: string | undefined | null) =>
  v == null || v.length < 1 ? undefined : v;

export function stripNonNumericChars(str: string): string {
  return str.trim().replace(/\D/g, "");
}

export const defaultString = z.string().trim();
export const defaultOptionalString = optionalString(defaultString);

const zipLength = 5;
export const defaultZipString = z.coerce
  .string()
  .transform(zipStr => stripNonNumericChars(zipStr))
  .refine(zip => zip.length === zipLength, {
    message: `Zip must be a string consisting of ${zipLength} numbers`,
  });
