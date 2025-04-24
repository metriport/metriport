export type ParsingError = { field: string; error: string };

export function escapeCsvValueIfNeeded(value: string) {
  if (value.includes(",")) {
    return `"${value}"`;
  }
  return value;
}
