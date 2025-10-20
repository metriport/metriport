export function recordToFileContents(payload: unknown): string {
  return JSON.stringify(payload, null, 2);
}
