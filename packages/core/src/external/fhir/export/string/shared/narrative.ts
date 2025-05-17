import { Narrative } from "@medplum/fhirtypes";
import { FIELD_SEPARATOR } from "./separator";

const filterFromDiv = ['<div xmlns="http://www.w3.org/1999/xhtml">', "<div>", "</div>", "<div/>"];

/**
 * Formats a FHIR Narrative into a string representation
 */
export function formatNarrative(
  narrative: Narrative | undefined,
  label: string
): string | undefined {
  if (!narrative?.div) return undefined;
  const filteredDiv = narrative.div?.replace(new RegExp(filterFromDiv.join("|"), "g"), "");
  if (!filteredDiv || filteredDiv.length < 1) return undefined;
  const parts: string[] = [];
  if (narrative.status) {
    parts.push(`Status: ${narrative.status}`);
  }
  parts.push(`${label}: ${filteredDiv}`);
  return parts.join(FIELD_SEPARATOR);
}
