import { toTitleCase } from "../../common/title-case";

export function normalizeCity(city: string): string {
  return toTitleCase(city).trim();
}
