export function limitStringLength(
  value: string | undefined,
  max = 255,
  suffix = "..."
): string | undefined {
  if (!value) return value;
  return value.length > max && value.length > suffix.length
    ? value.substring(0, max - suffix.length) + suffix
    : value;
}

export function stripNonNumericChars(str: string): string {
  return str.trim().replace(/\D/g, "");
}

export function toTitleCase(str: string): string {
  return str
    .toLowerCase()
    .split(" ")
    .map(s => s.charAt(0).toUpperCase() + s.substring(1))
    .join(" ")
    .trim();
}
