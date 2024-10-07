const validCountryStrings = ["usa", "us", "u.s.", "u.s.a.", "united states"];

export const defaultCountry = "usa";

export function normalizeCountrySafe(country: string): string | undefined {
  const trimmedCountry = country.trim().toLowerCase();
  if (!validCountryStrings.includes(trimmedCountry)) return undefined;
  return defaultCountry;
}

export function normalizeCountry(country: string): string {
  const countryOrUndefined = normalizeCountrySafe(country);
  if (!countryOrUndefined) throw new Error("Invalid country.");
  return countryOrUndefined;
}
