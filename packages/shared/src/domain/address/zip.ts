import { z } from "zod";

export const zipLength = 5;

function isValidZipCode(zipCode: string): boolean {
  if (!zipCode) return false;
  if (zipCode.length < 3) return false;
  if (!zipCode.match(/^[0-9-]+$/)) return false;
  if (zipCode.includes("-") && zipCode.split("-").length !== 2) return false;
  return true;
}

function isValidZipCodeMainPart(zipCode: string): boolean {
  if (!zipCode) return false;
  if (zipCode.length < 3) return false;
  if (!zipCode.match(/^[0-9]+$/)) return false;
  return true;
}

function noramlizeZipBase(zipCode: string): string {
  return zipCode.trim();
}

export function normalizeZipCodeSafe(
  zipCode: string,
  normalizeBase: (zipCode: string) => string = noramlizeZipBase
): string | undefined {
  const baseZip = normalizeBase(zipCode);
  if (!isValidZipCode(baseZip)) return undefined;
  const baseZipMainPart = baseZip.split("-")[0];
  if (!baseZipMainPart) return undefined;
  if (!isValidZipCodeMainPart(baseZipMainPart)) return undefined;
  if (baseZipMainPart.length === zipLength) return baseZipMainPart;
  if (baseZipMainPart.length < zipLength) return baseZipMainPart.padStart(zipLength, "0");
  return baseZipMainPart.slice(0, zipLength);
}

export function normalizeZipCode(zipCode: string): string {
  const zipOrUndefined = normalizeZipCodeSafe(zipCode);
  if (!zipOrUndefined) throw new Error("Invalid Zip.");
  return zipOrUndefined;
}

export const zipSchema = z.coerce
  .string()
  .refine(normalizeZipCodeSafe, { message: "Invalid zip" })
  .transform(zip => normalizeZipCode(zip));
