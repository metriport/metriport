import { Duration } from "@medplum/fhirtypes";
import { defaultIsDebug } from "./debug";
import { FIELD_SEPARATOR } from "./separator";

/**
 * Formats a FHIR Duration object into a string representation
 */
export function formatDuration({
  duration,
  label,
  isDebug = defaultIsDebug,
}: {
  duration: Duration | undefined;
  label?: string;
  isDebug?: boolean | undefined;
}): string | undefined {
  if (!duration) return undefined;
  const parts: string[] = [];
  if (duration.value !== undefined) parts.push(duration.value.toString());
  if (duration.unit) parts.push(duration.unit);
  if (duration.code) parts.push(`(${duration.code})`);
  if (parts.length < 1) return undefined;
  const formattedDuration = parts.join(FIELD_SEPARATOR);
  return isDebug && label ? `${label}: ${formattedDuration}` : formattedDuration;
}
