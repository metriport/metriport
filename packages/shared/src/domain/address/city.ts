import { toTitleCase } from "../../common/title-case";

export function normalizeCity(city: string): string | undefined {
  return toTitleCase(city).trim();
}
