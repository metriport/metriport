export const csvSeparator = "\t";
export const safeCsvSeparator = " ";

export function normalizeForCsv(value: string | number | boolean): string {
  return value
    .toString()
    .replaceAll(csvSeparator, safeCsvSeparator)
    .replaceAll("\n", safeCsvSeparator);
}
