import { Reference } from "@medplum/fhirtypes";
import { defaultIsDebug } from "./debug";
import { FIELD_SEPARATOR } from "./separator";

/**
 * Formats a FHIR reference into a string representation
 */
export function formatReferences({
  references,
  label,
  isDebug = defaultIsDebug,
}: {
  references: Reference[] | undefined;
  label?: string;
  isDebug?: boolean | undefined;
}): string | undefined {
  if (!references?.length) return undefined;

  const formattedRefs = references.flatMap(
    reference => formatReference({ reference, isDebug }) ?? []
  );
  if (formattedRefs.length < 1) return undefined;

  const formatted = formattedRefs.join(FIELD_SEPARATOR);
  return isDebug && label ? `${label}: ${formatted}` : formatted;
}

export function formatReference({
  reference,
  label,
  isDebug = defaultIsDebug,
}: {
  reference: Reference | undefined;
  label?: string;
  isDebug?: boolean | undefined;
}): string | undefined {
  const formattedRef = [reference?.reference?.trim(), reference?.display?.trim()]
    .filter(Boolean)
    .join(" ");
  if (formattedRef.length < 1) return undefined;
  return isDebug && label ? `${label}: ${formattedRef}` : formattedRef;
}
