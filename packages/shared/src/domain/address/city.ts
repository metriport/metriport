import { toTitleCase } from "../../common/title-case";

export function normalizeCity(city: string): string | undefined {
  if (city == undefined) return undefined;
  return toTitleCase(city).trim();
}
