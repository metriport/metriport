import { Period } from "@medplum/fhirtypes";
import { parseNumber } from "./number";

export function parsePeriodFromString(periodString: string): Period | undefined {
  const { value, remainder } = parseNumber(periodString);
  if (value == null) return undefined;

  const periodUnit = remainder.trim().toLowerCase();
  if (periodUnit === "day") {
    return {
      start: new Date().toISOString(),
      end: new Date(Date.now() + value * 24 * 60 * 60 * 1000).toISOString(),
    };
  }
  return undefined;
}
