import { stripPeriods } from "../../common/string";
import { BadRequestError } from "../../error/bad-request";

const validCountryStrings = ["US", "USA", "UNITED STATES", "UNITED STATES OF AMERICA"];

export const normalizedCountryUsa = "USA";

function isValidCountry(country: string) {
  if (!validCountryStrings.includes(country)) return false;
  return true;
}

function normalizeCountryBase(country: string): string {
  return stripPeriods(country.trim().toUpperCase());
}

export function normalizeCountrySafe(
  country: string,
  normalizeBase: (country: string) => string = normalizeCountryBase
): string | undefined {
  const baseCountry = normalizeBase(country);
  if (!isValidCountry(baseCountry)) return undefined;
  return normalizedCountryUsa;
}

export function normalizeCountry(country: string): string {
  const countryOrUndefined = normalizeCountrySafe(country);
  if (!countryOrUndefined) {
    throw new BadRequestError("Invalid country", undefined, { country });
  }
  return countryOrUndefined;
}
