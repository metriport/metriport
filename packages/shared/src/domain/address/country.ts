import { stripPeriods } from "../../common/string";

const validCountryStrings = ["US", "USA", "UNITED STATES", "UNITED STATES OF AMERICA"];

export const normalizedCountryUsa = "USA";

export function normalizeCountrySafe(country: string): string | undefined {
  const strippedCountry = stripPeriods(country.trim().toUpperCase());
  if (!validCountryStrings.includes(strippedCountry)) return undefined;
  return normalizedCountryUsa;
}

export function normalizeCountry(country: string): string {
  const countryOrUndefined = normalizeCountrySafe(country);
  if (!countryOrUndefined) throw new Error("Invalid country.");
  return countryOrUndefined;
}
