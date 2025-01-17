import { v3 } from "uuid";

/**
 * Turns a string into a UUID in a deterministic manner
 */
export function createUuidFromText(input: string): string {
  return v3(input, v3.URL);
}
