import { Duration } from "@medplum/fhirtypes";
import { FIELD_SEPARATOR } from "./separator";

/**
 * Formats a FHIR Duration object into a string representation
 */
export const formatDuration = (
  duration: Duration | undefined,
  label?: string
): string | undefined => {
  if (!duration) return undefined;

  const parts: string[] = [];
  if (duration.value !== undefined) parts.push(duration.value.toString());
  if (duration.unit) parts.push(duration.unit);
  if (duration.code) parts.push(`(${duration.code})`);
  if (parts.length < 1) return undefined;

  const formattedDuration = parts.join(FIELD_SEPARATOR);
  return label ? `${label}: ${formattedDuration}` : formattedDuration;
};
