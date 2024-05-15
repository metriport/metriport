/**
 * Normalizes a zip code by taking the first 4-5 characters.
 * @param zipCode - The zip code to be normalized.
 * @returns The normalized zip code as a string.
 */
export function normalizeZipCode(zipCode: string): string {
  if (!isValidZipCode(zipCode)) {
    throw new Error("Zip codes may only contain numbers (0-9) and a dash (-)");
  }
  if (zipCode.includes("-") && zipCode.length === 9) return zipCode.slice(0, 4);
  if (zipCode.length === 8) return zipCode.slice(0, 4);
  return zipCode.slice(0, 5);
}

function isValidZipCode(zipCode: string): boolean {
  if (zipCode.length === 0) return false;
  const regex = /[^0-9-]/;
  const res = regex.test(zipCode);
  return !res;
}
