/**
 * Normalizes a zip code by taking the first 4-5 characters.
 * @param zipCode - The zip code to be normalized.
 * @returns The normalized zip code as a string.
 */
export function normalizeZipCode(zipCode: string): string {
  if (zipCode.includes("-") && zipCode.length === 9) {
    return zipCode.slice(0, 4);
  }
  return zipCode.slice(0, 5);
}
