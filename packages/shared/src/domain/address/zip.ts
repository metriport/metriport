export function normalizeZipCodeNew(
  zipCode: string,
  normalizeFn = normalizeZipCodeNewSafe
): string {
  const zipOrUndefined = normalizeFn(zipCode);
  if (!zipOrUndefined) throw new Error("Invalid Zip.");
  return zipOrUndefined;
}

// TODO Should prob look into something that indicates ranges of possible values, like https://www.fincen.gov/sites/default/files/shared/us_state_territory_zip_codes.pdf
export function normalizeZipCodeNewSafe(zipCode: string): string | undefined {
  const trimmedZip = zipCode.trim();

  if (trimmedZip === "") return undefined;
  if (!trimmedZip.match(/^[0-9-]+$/)) return undefined;

  // Accepts 3-5 digits + hyphen + 0-4 digits (e.g., 123-1234, 12345-1234, 2342-1, 12345-)
  if (trimmedZip.includes("-")) {
    const zipPlus4Match = trimmedZip.match(/^(\d{3,5})-(\d{0,4})$/);
    if (!zipPlus4Match) return undefined;
    const mainPart = zipPlus4Match[1] ?? "";
    const plus4Part = zipPlus4Match[2] ?? "";
    const paddedMain = mainPart.padStart(5, "0");
    return plus4Part.length === 4 ? `${paddedMain}-${plus4Part}` : paddedMain;
  }

  // Handle 9-digit format (ZIP+4 without hyphen)
  if (trimmedZip.length === 9) {
    return trimmedZip.slice(0, 5) + "-" + trimmedZip.slice(5); // Add hyphen for USPS compliance
  }

  if (trimmedZip.length === 5) return trimmedZip;
  if (trimmedZip.length < 3) return undefined;
  if (trimmedZip.length < 5) return trimmedZip.padStart(5, "0");
  // if super long, return the first 5 digits (but at least our UI should block such case)
  return trimmedZip.slice(0, 5);
}
