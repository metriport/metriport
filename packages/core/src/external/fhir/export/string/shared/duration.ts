import { Duration } from "@medplum/fhirtypes";
import { defaultIsDebug } from "./debug";

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
  const { value, unit, code } = duration;
  const parts: string[] = [];
  if (value != undefined) parts.push(value.toString());
  if (unit) parts.push(unit);
  if (code) parts.push(`(${code})`);
  if (parts.length < 1) return undefined;
  const formattedDuration = parts.join(" ");
  return isDebug && label ? `${label}: ${formattedDuration}` : formattedDuration;
}
