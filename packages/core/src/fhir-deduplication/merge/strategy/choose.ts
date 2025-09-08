export function chooseMasterOnly<T>(master: T | undefined): T | undefined {
  return master;
}

export function chooseHighestPrecedence<T>(master: T | undefined, values: T[]): T | undefined {
  if (master !== undefined) return master;
  const lastValue = values[values.length - 1];
  if (lastValue !== undefined) return lastValue;
  return undefined;
}
