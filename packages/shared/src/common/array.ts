export function toArray<T>(input: T | T[] | "" | undefined): T[] {
  if (input == undefined || input === "") {
    return [];
  }
  return Array.isArray(input) ? input : [input];
}
