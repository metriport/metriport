/**
 * Cleans up a query string by removing the additional chars used by our search implementation.
 *
 * @param query The query string to clean up.
 * @returns The cleaned up query string.
 */
export function cleanupQuery(query: string): string {
  return query.replace(new RegExp(`^\\$\\s*`, "g"), "").trim();
}
