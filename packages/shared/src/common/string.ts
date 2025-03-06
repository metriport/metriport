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
