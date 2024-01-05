export function getFloatValue(value: string | number): number {
  return typeof value === "string" ? parseFloat(value) : value;
}

// Truncate the number to 2 decimal places
export function formatNumber(num: number): number {
  return Math.floor(num * 100) / 100;
}

export function randomInt(maxDigits = 2): number {
  return Math.floor(Math.random() * Math.pow(10, maxDigits));
}
