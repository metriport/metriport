export function getFloatValue(value: string | number): number {
  return typeof value === "string" ? parseFloat(value) : value;
}

/**
 * Truncate the number to 2 decimal places
 */
export function formatNumber(num: number): number {
  return Math.floor(num * 100) / 100;
}

/**
 * Format a number to a human readable string, with optional decimal places and thousand separator.
 */
export function abbreviateNumber(num: number): string {
  if (num < 1_000) {
    return numberToString(num, 1);
  }
  if (num < 1_000_000) {
    return `${numberToString(num / 1000, 1)}K`;
  }
  if (num < 1_000_000_000) {
    return `${numberToString(num / 1_000_000, 1)}M`;
  }
  return `${numberToString(num / 1_000_000_000, 1)}G`;
}

/**
 * Format a number to a string, with optional decimal places and thousand separator.
 *
 * @param num the number to format
 * @param digits number of decimal places, only used if `thousandSeparator` is true
 * @param thousandSeparator if true (default), use Intl.NumberFormat to format the number; otherwise,
 *                          return the number without formatting.
 */
export function numberToString(num: number, digits = 2, thousandSeparator = true): string {
  const asString = num.toFixed(digits);
  if (!thousandSeparator) return asString;
  const parts = asString.split(".");
  const integerPart = parts[0] ?? 0;
  const decimalPart = parts[1];
  const integerPartWithSeparator = integerPart
    ? Intl.NumberFormat("en-US").format(Number(integerPart))
    : integerPart;
  if (decimalPart == undefined) return integerPartWithSeparator.toString();
  return `${integerPartWithSeparator}.${decimalPart}`;
}

export function randomInt(maxDigits = 2): number {
  return Math.floor(Math.random() * Math.pow(10, maxDigits));
}

export function randomIntBetween(min: number, max: number): number {
  if (min > max) {
    throw new Error("min must be less than max");
  }
  if (isNaN(min) || isNaN(max)) {
    throw new Error("min and max must be numbers");
  }
  return Math.floor(Math.random() * (max - min + 1)) + min;
}
