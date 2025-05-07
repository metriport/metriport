import { Reference } from "@medplum/fhirtypes";

/**
 * Formats a FHIR reference into a string representation
 * @param references - List of FHIR references to format
 * @param label - Label to prefix the formatted string with
 * @returns Formatted string of references
 */
export function formatReferences(
  references: Reference[] | undefined, // eslint-disable-line @typescript-eslint/no-unused-vars
  label: string // eslint-disable-line @typescript-eslint/no-unused-vars
): string | undefined {
  // TODO Prob need to provide the whole bundle so we can get a short text description of the reference
  return undefined;

  // if (!references?.length) return "";

  // const formattedRefs = references
  //   .map(ref => ref.display ?? ref.reference)
  //   .join(FIELD_SEPARATOR);

  // return `${label}: ${formattedRefs}`;
}
