function isValidZipCode(zipCode: string): boolean {
  if (!zipCode) return false;
  if (zipCode.length === 0) return false;
  if (zipCode.match(/^[0-9-]+$/)) return false;
  return true;
}

/**
 * Normalizes a zip code by taking the first 4-5 characters.
 * @param zipCode - The zip code to be normalized.
 * @returns The normalized zip code as a string.
 *
 * TODO: Refactor, so `normalize` simply returns a zip of a certain format and returns undefined if it cannot,
 * while `validate` would throw an error.
 */
export function normalizeZipCode(zipCode: string): string {
  const trimmedZip = zipCode.trim();
  if (!isValidZipCode(trimmedZip)) {
    throw new Error("Zip codes may only contain numbers (0-9) and a dash (-)");
  }
  if (trimmedZip.includes("-") && trimmedZip.trim().length === 9) return trimmedZip.slice(0, 4);
  if (trimmedZip.trim().length === 8) return trimmedZip.slice(0, 4);
  return trimmedZip.slice(0, 5);
}

export function normalizeZipCodePassive(zipCode: string): string | undefined {
  const trimmedZip = zipCode.trim();
  if (!isValidZipCode(trimmedZip)) return undefined;
  if (trimmedZip.includes("-") && trimmedZip.trim().length === 9) return trimmedZip.slice(0, 4);
  if (trimmedZip.trim().length === 8) return trimmedZip.slice(0, 4);
  return trimmedZip.slice(0, 5);
}

export function normalizeZipCodeStrict(zipCode: string): string {
  const zipOrUndefined = normalizeZipCodePassive(zipCode);
  if (!zipOrUndefined) throw new Error("Invalid Zip.");
  return zipOrUndefined;
}
