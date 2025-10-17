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

/**
 * Splits a string into chunks with specified overlap between consecutive chunks.
 * Useful for processing large text with context preservation between chunks.
 *
 * @param str The string to chunk
 * @param chunkSize The size of each chunk
 * @param overlapSize The size of overlap between consecutive chunks (must be less than chunkSize)
 * @returns Array of overlapping string chunks
 *
 * @example
 * chunkWithOverlap("abcdefghij", 4, 2)
 * // Returns: ["abcd", "cdef", "efgh", "ghij"]
 */
export function chunkWithOverlap({
  str,
  chunkSize,
  overlapSize,
}: {
  str: string;
  chunkSize: number;
  overlapSize: number;
}): string[] {
  if (chunkSize <= 0) {
    throw new Error("chunkSize must be greater than 0");
  }
  if (overlapSize < 0) {
    throw new Error("overlapSize must be non-negative");
  }
  if (overlapSize >= chunkSize) {
    throw new Error("overlapSize must be less than chunkSize");
  }
  if (str.length === 0) {
    return [];
  }

  const chunks: string[] = [];
  const step = chunkSize - overlapSize;
  let position = 0;

  while (position < str.length) {
    const chunk = str.slice(position, position + chunkSize);
    chunks.push(chunk);
    position += step;
  }

  return chunks;
}
