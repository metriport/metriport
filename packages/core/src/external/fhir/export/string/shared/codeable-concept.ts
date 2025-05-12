import { CodeableConcept } from "@medplum/fhirtypes";
import { checkDeny } from "./deny";
import { FIELD_SEPARATOR } from "./separator";

/**
 * Formats a single FHIR codeable concept into a string representation
 * @param concept - FHIR codeable concept to format
 * @returns Formatted string of codeable concept
 */
export function formatCodeableConcept(concept: CodeableConcept | undefined): string | undefined {
  if (!concept) return undefined;

  // Prefer text if available
  if (concept.text) return checkDeny(concept.text);

  // Otherwise use coding display or code
  return concept.coding?.map(c => checkDeny(c.display ?? c.code)).join(FIELD_SEPARATOR) ?? "";
}

/**
 * Formats a list of FHIR codeable concepts into a string representation
 * @param concepts - List of FHIR codeable concepts to format
 * @param label - Label to prefix the formatted string with
 * @returns Formatted string of codeable concepts
 */
export function formatCodeableConcepts(
  concepts: CodeableConcept[] | undefined,
  label: string
): string | undefined {
  if (!concepts?.length) return undefined;

  const formattedConcepts = concepts.map(formatCodeableConcept).filter(Boolean);
  if (!formattedConcepts.length) return undefined;

  const converted = formattedConcepts.join(FIELD_SEPARATOR);
  return `${label}: ${converted}`;
}
