import { ContactPoint } from "@medplum/fhirtypes";
import { FIELD_SEPARATOR } from "./separator";
import { defaultIsDebug } from "./debug";

/**
 * Formats a FHIR telecom into a string representation
 * @param telecoms - List of FHIR contact points to format
 * @param label - Label to prefix the formatted string with
 * @param isDebug - Whether to include the label in the output
 * @returns Formatted string of telecoms
 */
export function formatTelecoms({
  telecoms,
  label,
  isDebug = defaultIsDebug,
}: {
  telecoms: ContactPoint[] | undefined;
  label?: string;
  isDebug?: boolean | undefined;
}): string | undefined {
  if (!telecoms?.length) return undefined;
  const formattedTelecoms = telecoms
    .map(telecom => formatTelecom({ telecom, isDebug }))
    .filter(Boolean);
  if (formattedTelecoms.length < 1) return undefined;

  const formatted = formattedTelecoms.join(FIELD_SEPARATOR);
  return isDebug && label ? `${label}: ${formatted}` : formatted;
}

export function formatTelecom({
  telecom,
  label,
  isDebug = defaultIsDebug,
}: {
  telecom: ContactPoint | undefined;
  label?: string;
  isDebug?: boolean | undefined;
}): string | undefined {
  if (!telecom) return undefined;
  const { system, value } = telecom;
  const components = [
    system && isDebug ? `System: ${system}` : system,
    value && isDebug ? `Value: ${value}` : value,
    // use && isDebug ? `Use: ${use}` : use,
    // rank && isDebug ? `Rank: ${rank}` : rank,
  ].filter(Boolean);
  if (components.length < 1) return undefined;

  const formatted = components.join(FIELD_SEPARATOR);
  return isDebug && label ? `${label}: ${formatted}` : formatted;
}
