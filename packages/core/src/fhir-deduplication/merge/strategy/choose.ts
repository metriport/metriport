export function chooseMasterOnly<T>(master: T | undefined): T | undefined {
  return master;
}

/**
 * Returns the master value if it is not undefined or null. Otherwise, pick the highest precedence resource value.
 */
export function chooseHighestPrecedence<T>(master: T | undefined, values: T[]): T | undefined {
  if (master != null) return master;
  const highestPrecedenceValue = values[values.length - 1];
  return highestPrecedenceValue;
}
