import { startCase } from "lodash";

export function toTitleCase(str: string): string {
  const trimmedStr = str.trim();
  return startCase(trimmedStr.toLowerCase());
}
