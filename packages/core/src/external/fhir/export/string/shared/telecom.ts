import { ContactPoint } from "@medplum/fhirtypes";
import { FIELD_SEPARATOR } from "./separator";

/**
 * Formats a FHIR telecom into a string representation
 * @param telecoms - List of FHIR contact points to format
 * @returns Formatted string of telecoms
 */
export function formatTelecoms(
  telecoms: ContactPoint[] | undefined,
  label?: string
): string | undefined {
  if (!telecoms?.length) return undefined;
  const formattedTelecoms = telecoms.map(t => formatTelecom(t)).filter(Boolean);
  if (formattedTelecoms.length < 1) return undefined;

  const formatted = formattedTelecoms.join(FIELD_SEPARATOR);
  return label ? `${label}: ${formatted}` : formatted;
}

export function formatTelecom(
  telecom: ContactPoint | undefined,
  label?: string
): string | undefined {
  if (!telecom) return undefined;
  const components = [
    telecom.system && `System: ${telecom.system}`,
    telecom.value && `Value: ${telecom.value}`,
    // telecom.use && `Use: ${telecom.use}`,
    // telecom.rank && `Rank: ${telecom.rank}`,
  ].filter(Boolean);
  if (components.length < 1) return undefined;

  const formatted = components.join(FIELD_SEPARATOR);
  return label ? `${label}: ${formatted}` : formatted;
}
