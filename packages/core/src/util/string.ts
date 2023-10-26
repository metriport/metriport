/* eslint-disable @typescript-eslint/no-explicit-any */
export function sizeInBytes(str: string) {
  return new Blob([str]).size;
}

/**
 * Returns a string representation of the parameter. If its an object, its stringified.
 * If its a string, number, boolean, bigint or function, its converted to string.
 * If its undefined or null, it returns undefined or null.
 */
export function safeStringify(
  v: any,
  replacer?: (key: string, value: any) => any,
  space?: string | number
): string | undefined | null {
  if (v == undefined) return v;
  return typeof v === "object" ? JSON.stringify(v, replacer, space) : String(v);
}
