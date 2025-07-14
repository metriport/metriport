import { z, ZodString } from "zod";

export const defaultStringSchema = z.string().trim();
export const defaultOptionalStringSchema = optionalString(defaultStringSchema);

export const defaultNameStringSchema = defaultStringSchema.min(1);

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
