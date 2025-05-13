import { CodeableConcept } from "@medplum/fhirtypes";
import { checkDeny, isAllowedSystem } from "./deny";
import { FIELD_SEPARATOR } from "./separator";

const SEP_BETWEEN_CODING = "/";
const SEP_BETWEEN_TEXT_AND_CODING = ":";

/**
 * Formats a single FHIR codeable concept into a string representation
 * @param concept - FHIR codeable concept to format
 * @returns Formatted string of codeable concept
 */
export function formatCodeableConcept(concept: CodeableConcept | undefined): string | undefined {
  if (!concept) return undefined;

  const textPre = checkDeny(concept.text);
  const text = textPre ? textPre.trim() : undefined;

  const emptyCode = "<!empty!>";
  const codingMap =
    concept.coding?.reduce((acc, cur) => {
      const system = isAllowedSystem(cur.system);
      if (!system) return acc;
      const codePre = checkDeny(cur.code);
      const code = codePre ? codePre.trim() : undefined;
      const displayPre = checkDeny(cur.display);
      const display = displayPre ? displayPre.trim() : undefined;
      if (code) {
        if (acc[code]) return acc;
        acc[code] = codeAndDisplayToString(code, display);
        return acc;
      }
      const altCode = "";
      const codeAndDisplay = codeAndDisplayToString(altCode, cur.display);
      if (!codeAndDisplay) return acc;
      if (acc[emptyCode]) {
        acc[emptyCode] = acc[emptyCode] + "; " + codeAndDisplay;
      } else {
        acc[emptyCode] = codeAndDisplay;
      }
      return acc;
    }, {} as Record<string, string>) ?? {};

  let codingStr = "";
  for (const coding of Object.values(codingMap)) {
    const separator = codingStr.length > 0 ? ` ${SEP_BETWEEN_CODING} ` : "";
    codingStr = codingStr + separator + coding;
  }

  if (!codingStr && !text) return undefined;
  if (!codingStr && text) return text;
  return `${text ?? ""}${text ? `${SEP_BETWEEN_TEXT_AND_CODING} ` : ""}${codingStr}`;
}

function codeAndDisplayToString(code: string, display: string | undefined): string {
  return code + (display ? `${code ? " " : ""}(${display})` : "");
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
