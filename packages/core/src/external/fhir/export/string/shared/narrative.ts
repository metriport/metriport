import { Narrative } from "@medplum/fhirtypes";
import { FIELD_SEPARATOR } from "./separator";
import { defaultIsDebug } from "./debug";

const filterFromDiv = ['<div xmlns="http://www.w3.org/1999/xhtml">', "<div>", "</div>", "<div/>"];

/**
 * Formats a FHIR Narrative into a string representation
 */
export function formatNarrative({
  narrative,
  label,
  isDebug = defaultIsDebug,
}: {
  narrative: Narrative | undefined;
  label: string;
  isDebug?: boolean | undefined;
}): string | undefined {
  if (!narrative?.div) return undefined;
  const filteredDiv = narrative.div?.replace(new RegExp(filterFromDiv.join("|"), "g"), "");
  if (!filteredDiv || filteredDiv.length < 1) return undefined;
  const parts: string[] = [];
  if (narrative.status) {
    parts.push(isDebug ? `Status: ${narrative.status}` : narrative.status);
  }
  parts.push(isDebug ? `${label}: ${filteredDiv}` : filteredDiv);
  return parts.join(FIELD_SEPARATOR);
}
