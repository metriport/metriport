import dayjs from "dayjs";
import { z, ZodString } from "zod";

export const BASE_ADDRESS = "https://api.metriport.com";
export const BASE_ADDRESS_SANDBOX = "https://api.sandbox.metriport.com";
export const API_KEY_HEADER = "x-api-key";
export const DEFAULT_AXIOS_TIMEOUT_MILLIS = 20_000;

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
  message: `Date must be a valid ISO 8601 date formatted ${ISO_DATE}. Example: 2023-15-03`,
});
export const defaultNameString = defaultString.min(1);
