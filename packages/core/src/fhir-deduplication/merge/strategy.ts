export function chooseMasterOnly<T>(master: T | undefined): T | undefined {
  return master;
}

export function chooseMasterOrHighestPrecedence<T>(
  master: T | undefined,
  values: T[]
): T | undefined {
  if (master !== undefined) return master;
  const lastValue = values[values.length - 1];
  if (lastValue !== undefined) return lastValue;
  return undefined;
}

export function mergeArrays<T>(masterArray: T[] | undefined, values: T[][]): T[] | undefined {
  const mergedArray = masterArray ? [...masterArray] : [];
  for (const value of values) {
    mergedArray.push(...value);
  }
  return mergedArray;
}
