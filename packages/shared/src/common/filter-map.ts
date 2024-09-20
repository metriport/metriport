/**
 * Used in .flatMap() to filter out undefined values.
 *
 * Example:
 *
 * const arr = [1, null, 3, undefined, 5];
 * const filtered = arr.flatMap(filterTruthy);
 * // filtered = [1, 3, 5]
 */
export function filterTruthy<T>(o: T | undefined | null): T | [] {
  return o ? o : [];
}
