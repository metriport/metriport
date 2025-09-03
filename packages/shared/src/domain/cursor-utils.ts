import type { SortItem } from "./pagination-v2";

export type CursorPrimitive = string | number | boolean | null | undefined;
export type CompositeCursor = Record<string, CursorPrimitive>;

/**
 * Encodes a cursor object to a base64 string for use in pagination.
 * The cursor is JSON-stringified then base64-encoded for safe URL transmission.
 */
export function encodeCursor(cursorData: Record<string, CursorPrimitive>): string {
  const json = JSON.stringify(cursorData);
  return Buffer.from(json, "utf8").toString("base64");
}

/**
 * Decodes a base64-encoded cursor string back to an object.
 * Throws an error if the cursor is malformed or contains invalid JSON.
 */
export function decodeCursor(encodedCursor: string): Record<string, CursorPrimitive> {
  const decoded = Buffer.from(encodedCursor, "base64").toString("utf8");
  return JSON.parse(decoded);
}

/**
 * Creates a composite cursor from an item based on the specified sort fields.
 * Only includes the fields that are part of the sort criteria.
 */
export function createCompositeCursor<T extends Record<string, CursorPrimitive>>(
  item: T,
  sortFields: SortItem[]
): CompositeCursor {
  const cursor: CompositeCursor = {};
  for (const { col } of sortFields) {
    cursor[col] = item[col];
  }
  return cursor;
}
