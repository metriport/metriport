export function concatenateArrays<T>(masterArray: T[] | undefined, values: T[][]): T[] | undefined {
  const mergedArray = masterArray ? [...masterArray] : [];
  for (const value of values) {
    mergedArray.push(...value);
  }
  return mergedArray;
}
