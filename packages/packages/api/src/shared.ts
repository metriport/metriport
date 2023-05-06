import { z, ZodString } from "zod";
import dayjs from "dayjs";

export const BASE_ADDRESS = "https://api.metriport.com";
export const BASE_ADDRESS_SANDBOX = "https://api.sandbox.metriport.com";

export const emptyStringToUndefined = (v: string | undefined | null) =>
  v == null || v.length < 1 ? undefined : v;

export const optionalString = (zodSchema: ZodString) =>
  zodSchema.or(z.string().optional()).transform(emptyStringToUndefined);

export function stripNonNumericChars(str: string): string {
  return str.trim().replace(/\D/g, "");
}

export const ISO_DATE = "YYYY-MM-DD";
export const defaultString = z.string().trim();
export const defaultOptionalString = optionalString(defaultString);
export const defaultDateString = defaultString.refine(v => dayjs(v, ISO_DATE, true).isValid(), {
  message: `Date must be a valid ISO 8601 date formatted ${ISO_DATE}. Example: 2023-05-03`,
});
export const defaultNameString = defaultString.min(1);
