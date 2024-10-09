export const zipLength = 5;

function isValidZipCode(zipCode: string): boolean {
  if (!zipCode) return false;
  if (zipCode.length < 3) return false;
  if (!zipCode.match(/^[0-9-]+$/)) return false;
  if (zipCode.includes("-") && zipCode.split("-").length !== 2) return false;
  return true;
}

export function normalizeZipCodeSafe(zipCode: string): string | undefined {
  const trimmedZip = zipCode.trim();
  if (!isValidZipCode(trimmedZip)) return undefined;
  const trimmedZipMainPart = trimmedZip.split("-")[0];
  if (!trimmedZipMainPart) return undefined;
  if (!isValidZipCode(trimmedZipMainPart)) return undefined;
  if (trimmedZipMainPart.length === zipLength) return trimmedZipMainPart;
  if (trimmedZipMainPart.length < zipLength) return trimmedZipMainPart.padStart(zipLength, "0");
  return trimmedZipMainPart.slice(0, zipLength);
}

export function normalizeZipCode(zipCode: string): string {
  const zipOrUndefined = normalizeZipCodeSafe(zipCode);
  if (!zipOrUndefined) throw new Error("Invalid Zip.");
  return zipOrUndefined;
}
