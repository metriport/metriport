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
