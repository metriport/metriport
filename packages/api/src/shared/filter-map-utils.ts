export function filterTruthy<T>(o: T | undefined | null): T | [] {
  return o ? o : [];
}
