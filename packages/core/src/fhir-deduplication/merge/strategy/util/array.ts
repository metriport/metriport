export function lastElement<T>(array: T[]): T | undefined {
  const lastElement = array[array.length - 1];
  return lastElement;
}
