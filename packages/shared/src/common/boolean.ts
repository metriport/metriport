/**
 * Returns true if the value is true. It doesn't check for "truthyness"!
 * - if value is a string, it will normalized and compared agains "true";
 * - if value is a boolean, it will return the value;
 * - otherwise, it will return false.
 */
export function isTrue(value: unknown): boolean {
  if (!value) return false;
  if (typeof value === "string") return isTrueString(value);
  if (typeof value === "boolean") return value;
  return false;
}

export function isTrueString(value: string): boolean {
  if (!value) return false;
  const parsed = typeof value === "string" ? value.trim().toLowerCase() : value;
  return parsed === "true";
}
