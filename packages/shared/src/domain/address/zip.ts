function isValidZipCode(zipCode: string): boolean {
  if (!zipCode) return false;
  if (zipCode.length === 0) return false;
  if (!zipCode.match(/^[0-9-]+$/)) return false;
  return true;
}

export function isValidZipCodeStrict(zipCode: string): boolean {
  const isValid = isValidZipCode(zipCode);
  if (!isValid) return false;
  if (zipCode.length !== 5) return false;
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
export function normalizeZipCode(zipCode: string, strict = false): string {
  const zipOrUndefined = normalizeZipCodeSafe(zipCode, strict);
  if (!zipOrUndefined) throw new Error("Invalid Zip.");
  return zipOrUndefined;
}

export function normalizeZipCodeSafe(zipCode: string, strict = false): string | undefined {
  const trimmedZip = zipCode.trim();
  const validationFunc = strict ? isValidZipCodeStrict : isValidZipCode;
  if (!validationFunc(trimmedZip)) return undefined;
  if (trimmedZip.includes("-") && trimmedZip.trim().length === 9) return trimmedZip.slice(0, 4);
  if (trimmedZip.trim().length === 8) return trimmedZip.slice(0, 4);
  return trimmedZip.slice(0, 5);
}

// TODO 2330 Move/merge this to normalizeZipCode
export function normalizeZipCodeNew(
  zipCode: string,
  normalizeFn = normalizeZipCodeNewSafe
): string {
  const zipOrUndefined = normalizeFn(zipCode);
  if (!zipOrUndefined) throw new Error("Invalid Zip.");
  return zipOrUndefined;
}

// TODO 2330 Move/merge this to normalizeZipCodeSafe
// TODO Should prob look into something that indicates ranges of possible values, like https://www.fincen.gov/sites/default/files/shared/us_state_territory_zip_codes.pdf
export function normalizeZipCodeNewSafe(zipCode: string): string | undefined {
  const trimmedZip = zipCode.trim();
  if (trimmedZip === "") return undefined;
  if (!trimmedZip.match(/^[0-9-]+$/)) return undefined;
  if (trimmedZip.includes("-") && trimmedZip.split("-").length !== 2) return undefined;
  const mainPart = trimmedZip.split("-")[0];
  if (!mainPart) return trimmedZip;
  if (mainPart.length === 5) return mainPart;
  if (mainPart.length < 5) return mainPart.padStart(5, "0");
  return mainPart.slice(0, 5);
}
