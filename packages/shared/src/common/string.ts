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

/**
 * Prevents a class of errors where foo.bar?.trim() is called on unknown data (e.g. a FHIR resource),
 * which throws an error when bar is not a string as expected by the type. This also converts unexpected
 * numbers back to a string when returning the trimmed result.
 */
export function trimWhitespace(str: unknown): string | undefined {
  if (typeof str === "number") return str.toString();
  if (typeof str !== "string") return undefined;
  return str.trim();
}
