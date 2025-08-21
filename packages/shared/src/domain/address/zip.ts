import { MetriportError } from "../../error/metriport-error";

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
