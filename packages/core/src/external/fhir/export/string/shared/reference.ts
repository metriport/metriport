import { Reference } from "@medplum/fhirtypes";
import { FIELD_SEPARATOR } from "./separator";

/**
 * Formats a FHIR reference into a string representation
 */
export function formatReferences(
  references: Reference[] | undefined,
  label?: string
): string | undefined {
  if (!references?.length) return "";

  const formattedRefs = references.map(ref => formatReference(ref)).filter(Boolean);
  if (formattedRefs.length < 1) return undefined;

  const formatted = formattedRefs.join(FIELD_SEPARATOR);
  return label ? `${label}: ${formatted}` : formatted;
}

export function formatReference(ref: Reference | undefined, label?: string): string | undefined {
  if (!ref?.display) return undefined;
  const formattedRef = ref.display.trim();
  return label ? `${label}: ${formattedRef}` : formattedRef;
}
