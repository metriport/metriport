export const denyTextExact = ["UNK", "NI", "Note", "History and physical note"];
export const denyTextContains = ["Unknown", "Not Identified", "No data"].map(deny =>
  deny.toLowerCase()
);

/**
 * Returns undefined if the value is in the list of denied values, otherwise returns the value.
 */
export function emptyIfDenied(value: string | undefined): string | undefined {
  if (!value) return undefined;
  const v = value.trim();
  if (denyTextExact.includes(v)) return undefined;
  if (denyTextContains.some(deny => v.toLowerCase().includes(deny))) return undefined;
  return value;
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function isAllowedSystem(value: string | undefined): boolean {
  return true;
}
