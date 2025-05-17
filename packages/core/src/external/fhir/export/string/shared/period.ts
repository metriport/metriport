import { Period } from "@medplum/fhirtypes";

/**
 * Formats a FHIR period into a string representation
 * @param period - FHIR period to format
 * @param label - Label to prefix the formatted string with
 * @returns Formatted string of period
 */
export function formatPeriod(period: Period | undefined, label?: string): string | undefined {
  if (!period) return undefined;
  if (!period.start && !period.end) return undefined;
  const start = period.start ?? "unknown";
  const end = period.end ?? "ongoing";
  return label ? `${label}: ${start} to ${end}` : `${start} to ${end}`;
}
