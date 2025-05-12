export const denyTextExact = ["UNK", "NI"];
export const denyTextContains = ["Unknown", "Not Identified", "No data"].map(deny =>
  deny.toLowerCase()
);

export function checkDeny(value: string | undefined): string | undefined {
  if (!value) return undefined;
  const v = value.trim();
  if (denyTextExact.includes(v)) return undefined;
  if (denyTextContains.some(deny => v.toLowerCase().includes(deny))) return undefined;
  return value;
}
