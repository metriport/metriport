import { Period } from "@medplum/fhirtypes";
import { defaultIsDebug } from "./debug";

/**
 * Formats a FHIR period into a string representation
 * @param period - FHIR period to format
 * @param label - Label to prefix the formatted string with
 * @param isDebug - Whether to include the label in the output
 * @returns Formatted string of period
 */
export function formatPeriod({
  period,
  label,
  isDebug = defaultIsDebug,
}: {
  period: Period | undefined;
  label?: string;
  isDebug?: boolean | undefined;
}): string | undefined {
  if (!period) return undefined;
  if (!period.start && !period.end) return undefined;
  const start = period.start ?? "unknown";
  const end = period.end ?? "ongoing";
  return isDebug && label ? `${label}: ${start} to ${end}` : `${start} to ${end}`;
}
