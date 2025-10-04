export type ParsingError = { field: string; error: string };

export function escapeCsvValueIfNeeded(value: string) {
  const theValue = value.replace(/"/g, '""');
  if (theValue.includes(",")) {
    return `"${theValue}"`;
  }
  return theValue;
}

export function escapeCsvValue(value: string) {
  const theValue = value.replace(/"/g, '""');
  return `"${theValue}"`;
}
