export function getFloatValue(value: string | number): number {
  return typeof value === "string" ? parseFloat(value) : value;
}

// Truncate the number to 2 decimal places
export function formatNumber(num: number): number {
  return Math.floor(num * 100) / 100;
}
