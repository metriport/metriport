export const csvSeparator = "\t";
export const safeCsvSeparator = " ";

export function safeCsv(value: string | number | boolean): string {
  return value
    .toString()
    .replaceAll(csvSeparator, safeCsvSeparator)
    .replaceAll("\n", safeCsvSeparator);
}
