import { z } from "zod";
import { stripPeriods } from "../../common/string";

const validCountryStrings = ["US", "USA", "UNITED STATES", "UNITED STATES OF AMERICA"];

export const normalizedCountryUsa = "USA";

function isValidCountry(country: string) {
  if (!validCountryStrings.includes(country)) return false;
  return true;
}

function noramlizeCountryBase(country: string): string {
  return stripPeriods(country.trim().toUpperCase());
}

export function normalizeCountrySafe(
  country: string,
  normalizeBase: (country: string) => string = noramlizeCountryBase
): string | undefined {
  const baseCountry = normalizeBase(country);
  if (!isValidCountry(baseCountry)) return undefined;
  return normalizedCountryUsa;
}

export function normalizeCountry(country: string): string {
  const countryOrUndefined = normalizeCountrySafe(country);
  if (!countryOrUndefined) throw new Error("Invalid country.");
  return countryOrUndefined;
}

export const countrySchema = z
  .string()
  .refine(normalizeCountrySafe, { message: "Invalid country" })
  .transform(country => normalizeCountry(country));
