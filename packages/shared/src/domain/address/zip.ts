import { MetriportError } from "../../error/metriport-error";

export const zipLength = 5;

export const knownInvalidZipCodes = [
  "00000",
  "99999",
  "10000",
  "20000",
  "30000",
  "40000",
  "50000",
  "60000",
  "70000",
  "80000",
  "90000",
  "12345",
  "54321",
];

// TODO This should be more comprehensive and include a check for the length of the zip code
// and the contents (4324- should fail)
export function isValidZipCode(zipCode: string): boolean {
  if (!zipCode) return false;
  // TODO Ideally we'd call isValidZipCodeLength here, but this would be a breaking change at this point
  if (zipCode.length < 1) return false;
  if (!zipCode.match(/^[0-9-]+$/)) return false;
  if (knownInvalidZipCodes.some(invalidZipCode => zipCode === invalidZipCode)) return false;
  return true;
}

export function isValidZipCodeLength(zipCode: string): boolean {
  if (zipCode.length !== zipLength) return false;
  return true;
}

export function isValidZipCodeStrict(zipCode: string): boolean {
  const isValid = isValidZipCode(zipCode);
  if (!isValid) return false;
  return isValidZipCodeLength(zipCode);
}

// TODO 2330 Move/merge this to normalizeZipCode
export function normalizeZipCodeNew(
  zipCode: string,
  normalizeFn = normalizeZipCodeNewSafe
): string {
  const zipOrUndefined = normalizeFn(zipCode);
  if (!zipOrUndefined) throw new MetriportError("Invalid Zip.", undefined, { zipCode });
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
  if (mainPart.length < 3) return undefined;
  if (mainPart.length < 5) return mainPart.padStart(5, "0");
  return mainPart.slice(0, 5);
}
